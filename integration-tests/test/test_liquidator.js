import { expect } from 'chai';
import { BN, ether } from '@openzeppelin/test-helpers';
import sinon from 'sinon';

import A from '../../secrets/accounts';
import Liquidator from '../../controller/liquidator';
import Arbitrage from '../../controller/arbitrage';
import C from '../../controller/contract';
import PositionScanner from '../../controller/scanner';
import U from '../../util/helper';
import DB from '../../controller/db';

const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");
import {initSovrynNodeForTesting} from "./base/backend";
import {ConverterHelper, initSovrynContracts} from "./base/contracts";
import {initLoanPool, decodeLogs, setDemandCurve} from "./base/loans";

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

describe("Liquidator controller", () => {
    const sandbox = sinon.createSandbox();
    let liquidatorAddress;
    let lenderAddress;
    let borrowerAddress;
    let contractOwnerAddress;
    let positions;
    let liquidations;

    let sovrynContracts;
    let converters;
    let liquidityPool;

    const initialTokenBalance = ether('100000000');
    let initialRbtcBalance;

    beforeEach(async () => {
        liquidations = {};
        positions = {};
        sovrynContracts = await initSovrynContracts();
        await initSovrynNodeForTesting(sovrynContracts);
        converters = new ConverterHelper(sovrynContracts);

        contractOwnerAddress = sovrynContracts.accountOwner;
        liquidatorAddress = A.liquidator[0].adr;
        lenderAddress = sovrynContracts.accounts[0];
        borrowerAddress = sovrynContracts.accounts[1];
        PositionScanner.liquidations = liquidations;
        PositionScanner.positions = positions;
        PositionScanner.positionsTmp = {};
        Liquidator.positions = positions;
        Liquidator.liquidations = liquidations;
        Liquidator.liquidationErrorList = [];

        await initLoanPool({
            sovrynProtocol: sovrynContracts.sovrynProtocol,
            owner: sovrynContracts.accountOwner,
            wrbtcToken: sovrynContracts.wrbtcToken,
            token: sovrynContracts.docToken,
            loanToken: sovrynContracts.loanTokenDoc,
            loanTokenWrbtc: sovrynContracts.loanTokenWrbtc,
        });
        // the converter needs to be deployed, otherwise it won't work
        liquidityPool = await converters.initConverter({
            primaryReserveToken: sovrynContracts.wrbtcToken,
            secondaryReserveToken: sovrynContracts.docToken,
            initialPrimaryReserveLiquidity:       new BN('159658299529181487177'),
            initialSecondaryReserveLiquidity: new BN('2344204953216918397465575'),
            finalPrimaryReserveBalance:           new BN('184968372923849153200'),
            finalSecondaryReserveBalance:      new BN('769563135046785056451752'),
            finalPrimaryReserveWeight:   812160,
            finalSecondaryReserveWeight: 187840,
            primaryPriceOracleAnswer: new BN('63500099999999998544808'),
            secondaryPriceOracleAnswer:   new BN('1000000000000000000'),
        });

        // TODO: apparently we need the USDT pool to call Arbitrage.getRBtcPrices, which seems a bit silly
        await converters.initConverter({
            primaryReserveToken: sovrynContracts.wrbtcToken,
            secondaryReserveToken: sovrynContracts.usdtToken,
            initialPrimaryReserveLiquidity:       new BN('159658299529181487177'),
            initialSecondaryReserveLiquidity: new BN('2344204953216918397465575'),
            finalPrimaryReserveBalance:           new BN('184968372923849153200'),
            finalSecondaryReserveBalance:      new BN('769563135046785056451752'),
            finalPrimaryReserveWeight:   812160,
            finalSecondaryReserveWeight: 187840,
            primaryPriceOracleAnswer: new BN('63500099999999998544808'),
            secondaryPriceOracleAnswer:   new BN('1000000000000000000'),
        });

        await sovrynContracts.docToken.transfer(liquidatorAddress, initialTokenBalance);
        await sovrynContracts.wrbtcToken.transfer(liquidatorAddress, initialTokenBalance);
        await sovrynContracts.docToken.approve(sovrynContracts.sovrynProtocol.address, initialTokenBalance, {from: liquidatorAddress});
        await sovrynContracts.wrbtcToken.approve(sovrynContracts.sovrynProtocol.address, initialTokenBalance, {from: liquidatorAddress});

        await sovrynContracts.docToken.approve(sovrynContracts.rbtcWrapperProxy.address, initialTokenBalance, {from: liquidatorAddress});
        await sovrynContracts.wrbtcToken.approve(sovrynContracts.rbtcWrapperProxy.address, initialTokenBalance, {from: liquidatorAddress});

        initialRbtcBalance = web3.utils.toBN(await web3.eth.getBalance(liquidatorAddress));
    });

    beforeEach(() => {
        // setup mocks. we intentionally run this script
        // after running initSovrynNodeForTesting, since
        // that might otherwise destroy the mocks
        sandbox.spy(C.contractSovryn.methods, 'liquidate');

        // we don't want to waste 30s everytime :P
        sandbox.stub(U, 'wasteTime');
    });

    afterEach(() => {
        // clear mocks
        sandbox.restore();
    })

    const setupLiquidationTest = async (token, loanToken) => {
        const sovryn = sovrynContracts.sovrynProtocol;
        const wrbtcToken = sovrynContracts.wrbtcToken;

        await setDemandCurve(loanToken);
        await token.approve(loanToken.address, new BN(10).pow(new BN(40)));
        await loanToken.mint(lenderAddress, new BN(10).pow(new BN(30)));
        const loanTokenSent = hunEth;
        await token.mint(borrowerAddress, loanTokenSent);
        await token.approve(loanToken.address, loanTokenSent, { from: borrowerAddress });

        const { receipt } = await loanToken.marginTrade(
            "0x0", // loanId  (0 for new loans)
            new BN(2).mul(oneEth), // leverageAmount
            loanTokenSent, // loanTokenSent
            0, // no collateral token sent
            wrbtcToken.address, // collateralTokenAddress
            borrowerAddress, // trader,
            "0x", // loanDataBytes (only required with ether)
            { from: borrowerAddress }
        );

        const decode = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
        const loanId = decode[0].args["loanId"];
        const loan = await sovryn.getLoan(loanId);

        return {
            loan,
            loanId,
        };
    };

    async function scanPositions(from = 0, to = 100) {
        // because the PositionScanner logic is inside an infinite loop,
        // do this manually.
        // should rather refactor PositionScanner to be more testable
        const activePositions = await PositionScanner.loadActivePositions(from, to);
        PositionScanner.addPosition(activePositions);  // this mutates positionsTmp, not positions
        // we have to manually add them to the positions
        for(let [k, v] of Object.entries(PositionScanner.positionsTmp)) {
            positions[k] = v;
        }
        PositionScanner.positionsTmp = {};
    }

    async function getLiquidationsFromDB() {
        return await DB.liqRepo.all("SELECT * FROM liquidator");
    }

    it("should work when no liquidatable positions found", async () => {
        await setupLiquidationTest(sovrynContracts.docToken, sovrynContracts.loanTokenDoc);

        await scanPositions();

        await Liquidator.handleLiquidationRound();

        expect(C.contractSovryn.methods.liquidate.callCount).to.equal(0);

        const rows = await getLiquidationsFromDB();
        expect(rows.length).to.equal(0);
    });

    it("should liquidate liquidatable positions", async () => {
        const {
            loan,
            loanId,
        } = await setupLiquidationTest(sovrynContracts.docToken, sovrynContracts.loanTokenDoc);

        // decrease the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
            //new BN('63500099999999998544808')
            new BN('43500099999999998544808')
        );

        await scanPositions();

        await Liquidator.handleLiquidationRound();

        expect(C.contractSovryn.methods.liquidate.callCount).to.equal(1);

        const rows = await getLiquidationsFromDB();
        expect(rows.length).to.equal(1);
        const liquidationRow = rows[0];

        expect(liquidationRow.loanId).to.equal(loanId);

        expect(liquidationRow.liquidatorAdr.toLowerCase()).to.equal(liquidatorAddress.toLowerCase());

        expect(liquidationRow.liquidatedAdr.toLowerCase()).to.equal(borrowerAddress.toLowerCase());
        expect(liquidationRow.pos).to.equal('short'); // double check
        expect(liquidationRow.profit).to.equal('0.000223 RBTC'); // double check
        expect(liquidationRow.amount).to.equal('4688241921109492'); // double check
        // could maybe test something in the blockchain too...

        const { fromWei, toBN } = web3.utils;
        const rbtcBalance = toBN(await web3.eth.getBalance(liquidatorAddress));
        const docBalance = toBN(await sovrynContracts.docToken.balanceOf(liquidatorAddress));
        const rbtcEarned = parseFloat(fromWei(rbtcBalance.sub(initialRbtcBalance)));
        const docEarned =  parseFloat(fromWei(docBalance.sub(initialTokenBalance)));
        // expect us to earn RBTC because profit is calculated in oracle rate and amm rate is higher
        // this is flaky and subject to change
        expect(rbtcEarned).to.be.above(0.000223);
        // expect us to lose DoC since we are swapping back to rbtc
        expect(docEarned).to.be.below(0);
    });

    it("should handle liquidation error gracefully", async () => {
        const { loanId } = await setupLiquidationTest(sovrynContracts.docToken, sovrynContracts.loanTokenDoc);

        // decrease the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
            //new BN('63500099999999998544808')
            new BN('43500099999999998544808')
        );

        await scanPositions();

        C.contractSovryn.methods.liquidate.restore();
        sandbox.stub(C.contractSovryn.methods, 'liquidate').returns({
            send: async () => {
                throw new Error('Expected test error, please ignore!');
            },
        });
        sandbox.spy(Arbitrage, 'swap');

        await Liquidator.handleLiquidationRound();

        expect(C.contractSovryn.methods.liquidate.callCount).to.equal(1);

        const rows = await getLiquidationsFromDB();
        expect(rows.length).to.equal(1);
        const liquidationRow = rows[0];
        expect(liquidationRow.status).to.equal('failed');
        expect(liquidationRow.loanId).to.equal(loanId);

        expect(Arbitrage.swap.callCount).to.equal(0);

        expect(Liquidator.liquidationErrorList[loanId]).to.deep.equal(1);
    });
});
