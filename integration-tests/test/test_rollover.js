import { expect } from 'chai';
import { BN, ether, constants } from '@openzeppelin/test-helpers';
const { MAX_UINT256 } = constants;

import A from '../../secrets/accounts';
import Rollover from '../../controller/rollover';
import PositionScanner from '../../controller/scanner';

const FeesEvents = artifacts.require("FeesEvents");
const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");
const SwapsEvents = artifacts.require("SwapsEvents");
import {initSovrynNodeForTesting} from "./base/backend";
import {ConverterHelper, initSovrynContracts} from "./base/contracts";
import {initLoanPool, decodeLogs, setDemandCurve} from "./base/loans";
import { increaseTime, blockNumber } from './base/ethereum';


const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));


describe("Rollover controller", () => {
    let liquidatorAddress;
    let contractOwnerAddress;
    let positions;
    let liquidations;

    let sovrynContracts;
    let converters;

    beforeEach(async () => {
        liquidations = {};
        positions = {};
        sovrynContracts = await initSovrynContracts();
        await initSovrynNodeForTesting(sovrynContracts);
        converters = new ConverterHelper(sovrynContracts);

        contractOwnerAddress = sovrynContracts.accountOwner;
        liquidatorAddress = A.liquidator[0].adr;
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
        await converters.initConverter({
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

    });

    const setupRolloverTest = async (token, loanToken) => {
        const sovryn = sovrynContracts.sovrynProtocol;
        const wrbtcToken = sovrynContracts.wrbtcToken;
        const accounts = sovrynContracts.accounts;

        await setDemandCurve(loanToken);
        await token.approve(loanToken.address, new BN(10).pow(new BN(40)));
        const lender = accounts[0];
        const borrower = accounts[1];
        await loanToken.mint(lender, new BN(10).pow(new BN(30)));
        const loanTokenSent = hunEth;
        await token.mint(borrower, loanTokenSent);
        await token.approve(loanToken.address, loanTokenSent, { from: borrower });

        const { receipt } = await loanToken.marginTrade(
            "0x0", // loanId  (0 for new loans)
            new BN(2).mul(oneEth), // leverageAmount
            loanTokenSent, // loanTokenSent
            0, // no collateral token sent
            wrbtcToken.address, // collateralTokenAddress
            borrower, // trader,
            "0x", // loanDataBytes (only required with ether)
            { from: borrower }
        );

        const decode = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
        const loan_id = decode[0].args["loanId"];
        const loan = await sovryn.getLoan(loan_id);
        const num = await blockNumber();
        let currentBlock = await web3.eth.getBlock(num);
        const block_timestamp = currentBlock.timestamp;
        const time_until_loan_end = loan["endTimestamp"] - block_timestamp;
        await increaseTime(time_until_loan_end);
        return [borrower, loan, loan_id, parseInt(loan["endTimestamp"])];
    };


    it("should work", async () => {
        await setupRolloverTest(sovrynContracts.docToken, sovrynContracts.loanTokenDoc);
        const currentBlock = await web3.eth.getBlockNumber();
        const positions = await PositionScanner.loadActivePositions(0, currentBlock);
        console.log('positions:', positions);
        PositionScanner.addPosition(positions);
        const result = await Rollover.handleRolloverRound();
        expect(result).to.equal(undefined);
    });
});