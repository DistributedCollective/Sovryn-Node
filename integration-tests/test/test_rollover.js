import { expect } from 'chai';
import { BN } from '@openzeppelin/test-helpers';

import A from '../../secrets/accounts';
import Rollover from '../../controller/rollover';
import PositionScanner from '../../controller/scanner';
import DB from '../../controller/db';

const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");
import {initSovrynNodeForTesting} from "./base/backend";
import {ConverterHelper, initSovrynContracts} from "./base/contracts";
import {initLoanPool, decodeLogs, setDemandCurve} from "./base/loans";
import {increaseTime} from './base/ethereum';

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

describe("Rollover controller", () => {
    let rolloverAddress;
    let lenderAddress;
    let borrowerAddress;
    let contractOwnerAddress;
    let positions;
    let liquidations;

    let sovrynContracts;
    let converters;
    let liquidityPool;

    let currentTime = 1337000;
    let savedNow = Date.now;

    before(() => {
        // mock date function, always return currentTime
        global.Date.now = () => currentTime;
    })

    after(() => {
        // restore the mocked now function
        global.Date.now = savedNow;
    })

    beforeEach(async () => {
        liquidations = {};
        positions = {};
        sovrynContracts = await initSovrynContracts();
        await initSovrynNodeForTesting(sovrynContracts);
        converters = new ConverterHelper(sovrynContracts);

        contractOwnerAddress = sovrynContracts.accountOwner;
        rolloverAddress = A.rollover[0].adr;
        lenderAddress = sovrynContracts.accounts[0];
        borrowerAddress = sovrynContracts.accounts[1];
        PositionScanner.liquidations = liquidations;
        PositionScanner.positions = positions;
        PositionScanner.positionsTmp = {};
        Rollover.positions = positions;

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

        //await sovrynContracts.wrbtcToken.transfer(rolloverAddress, ether('100'));
        //await sovrynContracts.docToken.transfer(rolloverAddress, ether('100'));
        currentTime = 1337000;
    });

    const setupRolloverTest = async (token, loanToken) => {
        const sovryn = sovrynContracts.sovrynProtocol;
        const wrbtcToken = sovrynContracts.wrbtcToken;
        const accounts = sovrynContracts.accounts;

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

        // subtract a random amount from the liquidity pool so that min amount is ok when doing collateral
        // conversion.
        // argh.
        await liquidityPool.subtractFromReserveBalance(
            sovrynContracts.wrbtcToken.address,
            new BN('59658299529181487177')
        );

        return {
            loan,
            loanId,
            loanEndTimestamp: parseInt(loan.endTimestamp),
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

    async function advanceTime({
        blockchainTimestamp = 0,
        nodeTimestamp = 0,
    }) {
        if(blockchainTimestamp) {
            const currentBlock = await web3.eth.getBlock('latest');
            const difference = blockchainTimestamp - currentBlock.timestamp;
            if (difference < 0) {
                console.warn('would advance backwards which makes no sense');
            } else if (difference > 0) {
                await increaseTime(difference);
            }
        }

        if(nodeTimestamp) {
            currentTime = nodeTimestamp * 1000;
        }
    }

    async function getRolloversFromDB() {
        return await DB.rollRepo.all("SELECT * FROM rollover");
    }

    it("should not rollover when a loan has not expired", async () => {
        const {
            loanEndTimestamp,
            loanId,
        } = await setupRolloverTest(sovrynContracts.docToken, sovrynContracts.loanTokenDoc);

        await advanceTime({
            blockchainTimestamp: loanEndTimestamp - 1,
            nodeTimestamp: loanEndTimestamp - 1,
        });
        await scanPositions();

        await Rollover.handleRolloverRound();
        const rows = await getRolloversFromDB();
        expect(rows.length).to.equal(0);
    });

    it("should rollover when a loan has expired", async () => {
        const {
            loanEndTimestamp,
            loanId,
        } = await setupRolloverTest(sovrynContracts.docToken, sovrynContracts.loanTokenDoc);

        await advanceTime({
            blockchainTimestamp: loanEndTimestamp + 1,
            nodeTimestamp: loanEndTimestamp + 1,
        });
        await scanPositions();

        await Rollover.handleRolloverRound();
        const rows = await getRolloversFromDB();
        expect(rows.length).to.equal(1);
        const rolloverRow = rows[0];

        console.log(sovrynContracts.accounts);

        // TODO: what address should this be then?
        //expect(rolloverRow.rolloverAdr.toLowerCase()).to.equal(rolloverAddress.toLowerCase());

        expect(rolloverRow.rolledoverAdr.toLowerCase()).to.equal(borrowerAddress.toLowerCase());
        expect(rolloverRow.loanId).to.equal(loanId);
        expect(rolloverRow.amount).to.equal('0.000045');
        expect(rolloverRow.pos).to.equal('long');
        // could maybe test something in the blockchain too...
    });
});