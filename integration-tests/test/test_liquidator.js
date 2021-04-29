import { expect } from 'chai';
import { BN, ether } from '@openzeppelin/test-helpers';
import sinon from 'sinon';

import A from '../../secrets/accounts';
import Liquidator from '../../controller/liquidator';
import C from '../../controller/contract';
import PositionScanner from '../../controller/scanner';
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

    const initialTokenBalance = ether('100');

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
        })

        await sovrynContracts.docToken.transfer(liquidatorAddress, initialTokenBalance);
        await sovrynContracts.wrbtcToken.transfer(liquidatorAddress, initialTokenBalance);
        await sovrynContracts.docToken.approve(sovrynContracts.sovrynProtocol.address, initialTokenBalance, {from: liquidatorAddress});
        await sovrynContracts.wrbtcToken.approve(sovrynContracts.sovrynProtocol.address, initialTokenBalance, {from: liquidatorAddress});
        // NOT SURE if these needed
        await sovrynContracts.docToken.approve(sovrynContracts.sovrynSwapNetwork.address, initialTokenBalance, {from: liquidatorAddress});
        await sovrynContracts.wrbtcToken.approve(sovrynContracts.sovrynSwapNetwork.address, initialTokenBalance, {from: liquidatorAddress});
    });

    beforeEach(() => {
        // setup mocks. we intentionally run this script
        // after running initSovrynNodeForTesting, since
        // that might otherwise destroy the mocks
        sandbox.spy(C.contractSovryn.methods, 'liquidate');
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

    async function scanPositions(from = 0, to) {
        // because the PositionScanner logic is inside an infinite loop,
        // do this manually.
        // should rather refactor PositionScanner to be more testable
        if(to === undefined) {
            to = await web3.eth.getBlockNumber();
        }
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
});
