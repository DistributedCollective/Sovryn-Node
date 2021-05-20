import { expect } from 'chai';
import { BN, ether, constants } from '@openzeppelin/test-helpers';
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
import {transferAlmostAllRbtc} from "./base/utils";

const { MAX_UINT256 } = constants;
const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));

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

        const {
            docToken,
            loanTokenDoc,
            wrbtcToken,
            loanTokenWrbtc,
            usdtToken,
        } = sovrynContracts;
        await initLoanPool({
            sovrynProtocol: sovrynContracts.sovrynProtocol,
            owner: sovrynContracts.accountOwner,
            wrbtcToken: wrbtcToken,
            token: docToken,
            loanToken: loanTokenDoc,
            loanTokenWrbtc: loanTokenWrbtc,
        });
        // the converter needs to be deployed, otherwise it won't work
        liquidityPool = await converters.initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: docToken,
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
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken,
            initialPrimaryReserveLiquidity:       new BN('159658299529181487177'),
            initialSecondaryReserveLiquidity: new BN('2344204953216918397465575'),
            finalPrimaryReserveBalance:           new BN('184968372923849153200'),
            finalSecondaryReserveBalance:      new BN('769563135046785056451752'),
            finalPrimaryReserveWeight:   812160,
            finalSecondaryReserveWeight: 187840,
            primaryPriceOracleAnswer: new BN('63500099999999998544808'),
            secondaryPriceOracleAnswer:   new BN('1000000000000000000'),
        });

        // do these normal setups/approvals
        await docToken.transfer(liquidatorAddress, initialTokenBalance);
        await wrbtcToken.transfer(liquidatorAddress, initialTokenBalance);
        await docToken.approve(sovrynContracts.sovrynProtocol.address, initialTokenBalance, {from: liquidatorAddress});
        await wrbtcToken.approve(sovrynContracts.sovrynProtocol.address, initialTokenBalance, {from: liquidatorAddress});
        await docToken.approve(sovrynContracts.rbtcWrapperProxy.address, initialTokenBalance, {from: liquidatorAddress});
        await wrbtcToken.approve(sovrynContracts.rbtcWrapperProxy.address, initialTokenBalance, {from: liquidatorAddress});

        // handle loan token setups
        await docToken.approve(loanTokenDoc.address, new BN(10).pow(new BN(40)));
        await loanTokenDoc.mint(lenderAddress, new BN(10).pow(new BN(30)));
        await wrbtcToken.mint(lenderAddress, new BN(10).pow(new BN(30)));
        await wrbtcToken.approve(loanTokenWrbtc.address, new BN(10).pow(new BN(40)));
        await loanTokenWrbtc.mint(lenderAddress, new BN(10).pow(new BN(30)));

        await docToken.mint(borrowerAddress, initialTokenBalance);
        await docToken.approve(loanTokenDoc.address, initialTokenBalance, { from: borrowerAddress });
        await docToken.approve(loanTokenWrbtc.address, initialTokenBalance, { from: borrowerAddress });

        await wrbtcToken.mint(borrowerAddress, initialTokenBalance);
        await wrbtcToken.approve(loanTokenDoc.address, initialTokenBalance, { from: borrowerAddress });
        await wrbtcToken.approve(loanTokenWrbtc.address, initialTokenBalance, { from: borrowerAddress }); // needed?

        // store this at the very end
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

    const setupLiquidationTest = async ({
        loanToken,
        collateralToken,
        loanTokenSent,
        collateralTokenSent,
    }) => {
        const sovryn = sovrynContracts.sovrynProtocol;
        if(!loanToken) {
            loanToken = sovrynContracts.loanTokenDoc;
        }
        if(!collateralToken) {
            collateralToken = sovrynContracts.wrbtcToken;
        }
        if(!loanTokenSent) {
            if(collateralTokenSent) {
                loanTokenSent = 0;
            } else {
                loanTokenSent = ether('100');
                collateralTokenSent = 0;
            }
        } else if (!collateralTokenSent) {
            collateralTokenSent = 0;
        }

        await setDemandCurve(loanToken);

        const { receipt } = await loanToken.marginTrade(
            "0x0", // loanId  (0 for new loans)
            new BN(2).mul(oneEth), // leverageAmount
            loanTokenSent, // loanTokenSent
            collateralTokenSent, // collateralTokenSent
            collateralToken.address, // collateralTokenAddress
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
        await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenDoc
        });

        await scanPositions();

        await Liquidator.handleLiquidationRound();

        expect(C.contractSovryn.methods.liquidate.callCount).to.equal(0);

        const rows = await getLiquidationsFromDB();
        expect(rows.length).to.equal(0);
    });

    it("test what happens in a short margin trade", async () => {
        const { fromWei, toBN } = web3.utils;
        const initialRbtcBalance = toBN(await web3.eth.getBalance(borrowerAddress));
        const initialWrbtcBalance = toBN(await sovrynContracts.wrbtcToken.balanceOf(borrowerAddress));
        const initialDocBalance = toBN(await sovrynContracts.docToken.balanceOf(borrowerAddress));

         await setupLiquidationTest({
             loanToken: sovrynContracts.loanTokenDoc,
             loanTokenSent: ether('100'),
         });

        const rbtcBalance = toBN(await web3.eth.getBalance(borrowerAddress));
        const wrbtcBalance = toBN(await sovrynContracts.wrbtcToken.balanceOf(borrowerAddress));
        const docBalance = toBN(await sovrynContracts.docToken.balanceOf(borrowerAddress));
        const rbtcEarned = parseFloat(fromWei(rbtcBalance.sub(initialRbtcBalance)));
        const wrbtcEarned = parseFloat(fromWei(wrbtcBalance.sub(initialWrbtcBalance)));
        const docEarned =  parseFloat(fromWei(docBalance.sub(initialDocBalance)));

        expect(wrbtcEarned).to.equal(0);
        expect(docEarned).to.equal(-100); // sent a hunder doc
        expect(rbtcEarned).to.be.below(0); // gas
        expect(rbtcEarned).to.be.above(-0.015); // gas
    });

    it("test what happens in a short margin trade when collateral token sent", async () => {
        const { fromWei, toBN } = web3.utils;
        const initialRbtcBalance = toBN(await web3.eth.getBalance(borrowerAddress));
        const initialWrbtcBalance = toBN(await sovrynContracts.wrbtcToken.balanceOf(borrowerAddress));
        const initialDocBalance = toBN(await sovrynContracts.docToken.balanceOf(borrowerAddress));

        await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenDoc,
            collateralTokenSent: ether('1'),
        });

        const rbtcBalance = toBN(await web3.eth.getBalance(borrowerAddress));
        const wrbtcBalance = toBN(await sovrynContracts.wrbtcToken.balanceOf(borrowerAddress));
        const docBalance = toBN(await sovrynContracts.docToken.balanceOf(borrowerAddress));
        const rbtcEarned = parseFloat(fromWei(rbtcBalance.sub(initialRbtcBalance)));
        const wrbtcEarned = parseFloat(fromWei(wrbtcBalance.sub(initialWrbtcBalance)));
        const docEarned =  parseFloat(fromWei(docBalance.sub(initialDocBalance)));

        expect(wrbtcEarned).to.equal(-1);
        expect(docEarned).to.equal(0);
        expect(rbtcEarned).to.be.below(0); // gas
        expect(rbtcEarned).to.be.above(-0.015); // gas
    });

    it("test what happens in long margin trade", async () => {
        const { fromWei, toBN } = web3.utils;
        const initialRbtcBalance = toBN(await web3.eth.getBalance(borrowerAddress));
        const initialWrbtcBalance = toBN(await sovrynContracts.wrbtcToken.balanceOf(borrowerAddress));
        const initialDocBalance = toBN(await sovrynContracts.docToken.balanceOf(borrowerAddress));

        await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenWrbtc,
            collateralToken: sovrynContracts.docToken,
            loanTokenSent: ether('0.01'),
        });

        const rbtcBalance = toBN(await web3.eth.getBalance(borrowerAddress));
        const wrbtcBalance = toBN(await sovrynContracts.wrbtcToken.balanceOf(borrowerAddress));
        const docBalance = toBN(await sovrynContracts.docToken.balanceOf(borrowerAddress));
        const rbtcEarned = parseFloat(fromWei(rbtcBalance.sub(initialRbtcBalance)));
        const wrbtcEarned = parseFloat(fromWei(wrbtcBalance.sub(initialWrbtcBalance)));
        const docEarned =  parseFloat(fromWei(docBalance.sub(initialDocBalance)));

        expect(wrbtcEarned).to.equal(-0.01);
        expect(docEarned).to.equal(0);
        expect(rbtcEarned).to.be.below(0); // gas
        expect(rbtcEarned).to.be.above(-0.015); // gas
    });

    it("should liquidate liquidatable short position", async () => {
        const { loanId } = await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenDoc,
            loanTokenSent: ether('100'),
        });
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
        expect(liquidationRow.status).to.equal('successful');
        expect(liquidationRow.pos).to.equal('short');
        expect(liquidationRow.profit).to.equal('0.000223 RBTC'); // TODO: double check
        expect(liquidationRow.amount).to.equal('4688241921109492'); // TODO: double check
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

    it("should liquidate liquidatable long position", async () => {
        const { loanId } = await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenWrbtc,
            collateralToken: sovrynContracts.docToken,
            loanTokenSent: ether('1'),
        });
        // increase the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
            //new BN('63500099999999998544808')
            new BN('83500099999999998544808')
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
        expect(liquidationRow.status).to.equal('successful');
        expect(liquidationRow.pos).to.equal('long');
        expect(liquidationRow.profit).to.equal('7066.409797 DOC'); // TODO: double check
        expect(liquidationRow.amount).to.equal('148394605733814781412442'); // TODO: double check
        // could maybe test something in the blockchain too...

        const { fromWei, toBN } = web3.utils;
        const rbtcBalance = toBN(await web3.eth.getBalance(liquidatorAddress));
        const docBalance = toBN(await sovrynContracts.docToken.balanceOf(liquidatorAddress));
        const rbtcEarned = parseFloat(fromWei(rbtcBalance.sub(initialRbtcBalance)));
        const docEarned =  parseFloat(fromWei(docBalance.sub(initialTokenBalance)));

        // it doesn't do swapback. so it will lose rbtc
        expect(rbtcEarned).to.be.below(0);
        // expect us to earn more DOC than in the proft calculation, because that is calculated in oracle rate and amm rate is higher
        // this is flaky and subject to change
        expect(docEarned).to.be.above(7066.409797);
        expect(docEarned).to.be.closeTo(148394.6057338, 0.0000001); // this is just what we see in the output
    });

    it("should liquidate liquidatable short position when collateral token is sent", async () => {
        // TODO: if this test fails, just remove/redo it

        // TODO: too big a value causes errors. this should be tested too though
        const { loanId } = await setupLiquidationTest({
            collateralTokenSent: ether('0.0001'),
        });

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

        expect(liquidationRow.pos).to.equal('short');
        expect(liquidationRow.profit).to.equal('0.000009 RBTC'); // TODO: double check
        expect(liquidationRow.amount).to.equal('317272912639415'); // TODO: double check
        // could maybe test something in the blockchain too...

        // TODO: profit it so low it will actually lose money when gas costs are taken into account!!
        const { fromWei, toBN } = web3.utils;
        const rbtcBalance = toBN(await web3.eth.getBalance(liquidatorAddress));
        const docBalance = toBN(await sovrynContracts.docToken.balanceOf(liquidatorAddress));
        const rbtcEarned = parseFloat(fromWei(rbtcBalance.sub(initialRbtcBalance)));
        const docEarned =  parseFloat(fromWei(docBalance.sub(initialTokenBalance)));
        // expect us to earn RBTC because profit is calculated in oracle rate and amm rate is higher
        // this is flaky and subject to change
        //expect(rbtcEarned).to.be.above(0.000009);  // TODO: this is not the case
        // expect us to lose DoC since we are swapping back to rbtc
        expect(docEarned).to.be.below(0);
    });

    it("should liquidate liquidatable long position when collateral token is sent", async () => {
        const { loanId } = await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenWrbtc,
            collateralToken: sovrynContracts.docToken,
            loanTokenSent: 0,
            collateralTokenSent: ether('1000'),
        });

        // increase the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
            //new BN('63500099999999998544808')
            new BN('83500099999999998544808')
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
        expect(liquidationRow.status).to.equal('successful');
        expect(liquidationRow.pos).to.equal('long');
        expect(liquidationRow.profit).to.equal('77.002715 DOC'); // TODO: double check, doesn't seem right
        expect(liquidationRow.amount).to.equal('1617057007847678525139'); // TODO: double check
        // could maybe test something in the blockchain too...

        const { fromWei, toBN } = web3.utils;
        const rbtcBalance = toBN(await web3.eth.getBalance(liquidatorAddress));
        const docBalance = toBN(await sovrynContracts.docToken.balanceOf(liquidatorAddress));
        const rbtcEarned = parseFloat(fromWei(rbtcBalance.sub(initialRbtcBalance)));
        const docEarned =  parseFloat(fromWei(docBalance.sub(initialTokenBalance)));

        // it doesn't do swapback. so it will lose rbtc
        expect(rbtcEarned).to.be.below(0);
        // expect us to earn more DOC than in the profit calculation, because that is calculated in oracle rate and amm rate is higher
        // this is flaky and subject to change
        expect(docEarned).to.be.closeTo(1617.0570078476783, 0.0000001); // this is just what we see in the output
    });


    it("should handle liquidation error gracefully", async () => {
        const { loanId } = await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenDoc,
        });

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

    it("should not liquidate if token balance in wallet is 0", async () => {
        await setupLiquidationTest({
            loanToken: sovrynContracts.loanTokenDoc,
            loanTokenSent: ether('100'),
        });
        // decrease the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
            //new BN('63500099999999998544808')
            new BN('43500099999999998544808')
        );
        // liquidating this position takes ~194 DoC. Make sure the liquidator only has ~50 DoC
        const docBalanceBefore = await sovrynContracts.docToken.balanceOf(liquidatorAddress);
        await sovrynContracts.docToken.transfer(
            sovrynContracts.accountOwner,
            docBalanceBefore,
            { from: liquidatorAddress }
        );
        expect(await sovrynContracts.docToken.balanceOf(liquidatorAddress)).to.be.bignumber.equal(new BN(0));

        await scanPositions();

        await Liquidator.handleLiquidationRound();
        expect(C.contractSovryn.methods.liquidate.callCount).to.equal(0);
        const rows = await getLiquidationsFromDB();
        expect(rows.length).to.equal(0);
    });

    describe('when liquidator has (almost) no rbtc', () => {
        let initialRbtcBalance;
        let rbtcBalance;

        beforeEach(async () => {
            initialRbtcBalance = new BN(await web3.eth.getBalance(liquidatorAddress));
            rbtcBalance = await transferAlmostAllRbtc({
                from: liquidatorAddress,
                to: sovrynContracts.accountOwner,
                desiredRbtcBalance: ether('0'),
            })
        });

        after(async () => {
            await web3.eth.sendTransaction({
                from: sovrynContracts.accountOwner,
                to: liquidatorAddress,
                value: initialRbtcBalance.sub(ether('0.1')),
            });
        })

        it("should not liquidate if rbtc balance in wallet is close to 0", async () => {
            await setupLiquidationTest({
                loanToken: sovrynContracts.loanTokenWrbtc,
                collateralToken: sovrynContracts.docToken,
                loanTokenSent: ether('0.001'),
            });
            // increase the price so that the position needs to be liquidated
            await converters.setOraclePrice(
                sovrynContracts.wrbtcToken.address,
                new BN('83500099999999998544808')
            );

            await scanPositions();

            await Liquidator.handleLiquidationRound();
            expect(C.contractSovryn.methods.liquidate.callCount).to.equal(0);
            const rows = await getLiquidationsFromDB();
            expect(rows.length).to.equal(0);
        });
    })

    it("should not choke on big numbers", async () => {
        const { loanId } = await setupLiquidationTest({
            loanTokenSent: ether('1716'), // 21 digits so enough for it to become 1.716e+21 which used to choke it
        });
        // decrease the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
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
        expect(liquidationRow.status).to.equal('successful');
        expect(liquidationRow.pos).to.equal('short');
    });

    it("should not liquidate already liquidated positions", async () => {
        // simulate the race condition where a position is liquidated between scanning it by the Scanner
        // and liquidating it by the liquidator
        const { loanId } = await setupLiquidationTest({
            loanTokenSent: ether('100'),
        });
        // decrease the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
            //new BN('63500099999999998544808')
            new BN('33500099999999998544808')
        );

        await scanPositions();
        expect(Object.keys(liquidations).length).to.equal(1);

        // refresh loan after margin change
        let loan = await sovrynContracts.sovrynProtocol.getLoan(loanId);
        await sovrynContracts.docToken.approve(sovrynContracts.sovrynProtocol.address, MAX_UINT256);
        await sovrynContracts.sovrynProtocol.liquidate(loanId, liquidatorAddress, loan.maxLiquidatable);

        //loan = await sovrynContracts.sovrynProtocol.getLoan(loanId);
        //console.log('loan');
        //console.table(loan);

        await Liquidator.handleLiquidationRound();
        expect(C.contractSovryn.methods.liquidate.callCount).to.equal(0);
        const rows = await getLiquidationsFromDB();
        expect(rows.length).to.equal(0);
    });

    it('deletes liquidations', async () => {
        const { loanId } = await setupLiquidationTest({
            loanTokenSent: ether('1'), // 21 digits so enough for it to become 1.716e+21 which used to choke it
        });
        // decrease the price so that the position needs to be liquidated
        await converters.setOraclePrice(
            sovrynContracts.wrbtcToken.address,
            new BN('43500099999999998544808')
        );

        await scanPositions();

        expect(Object.keys(Liquidator.liquidations).length).to.equal(1);
        await Liquidator.handleLiquidationRound();
        expect(Object.keys(Liquidator.liquidations).length).to.equal(0);
    });
});
