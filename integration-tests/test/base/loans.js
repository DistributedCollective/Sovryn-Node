// This is forked sovryn-smart-contracts/tests-js/Utils/initializer.js
const { BN } = require("@openzeppelin/test-helpers");
const constants = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require("chai");

const ProtocolSettings = artifacts.require("ProtocolSettings");
const SovrynProtocol = artifacts.require("sovrynProtocol");
const ISovryn = artifacts.require("ISovryn");

const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const LoanClosings = artifacts.require("LoanClosings");

const SwapsExternal = artifacts.require("SwapsExternal");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicStandard = artifacts.require("LoanTokenLogicTest");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");

const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwap");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

const CONSTANTS = {
    ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
    ONE_ADDRESS: "0x0000000000000000000000000000000000000001",
    MAX_UINT: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
};

export const deploySovrynProtocol = async ({
    wrbtcToken,
    usdtToken,
    docToken,
    bproToken,
    contractRegistry,
    priceFeeds
}) => {
    const sovrynproxy = await SovrynProtocol.new();
    const sovryn = await ISovryn.at(sovrynproxy.address);

    await sovryn.replaceContract((await ProtocolSettings.new()).address);
    await sovryn.replaceContract((await LoanSettings.new()).address);
    await sovryn.replaceContract((await LoanMaintenance.new()).address);
    await sovryn.replaceContract((await SwapsExternal.new()).address);

    //const sovrynSwapSimulator = await TestSovrynSwap.new(priceFeeds.address);
    //await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
    await sovryn.setSovrynSwapContractRegistryAddress(contractRegistry.address);

    await sovryn.setSupportedTokens(
        [usdtToken.address, docToken.address, bproToken.address, wrbtcToken.address],
        [true, true, true, true]
    );

    await sovryn.setWrbtcToken(wrbtcToken.address);

    // loanOpening
    const swaps = await SwapsImplSovrynSwap.new();
    await sovryn.replaceContract((await LoanOpenings.new()).address);
    await sovryn.setPriceFeedContract(priceFeeds.address);
    await sovryn.setSwapsImplContract(swaps.address);

    // loanClosing
    await sovryn.replaceContract((await LoanClosings.new()).address);
    return sovryn;
};


// Loan Token

export const deployLoanTokenLogic = async () => {
    const loanTokenLogicStandard = await LoanTokenLogicStandard.new();
    return loanTokenLogicStandard;
};
export const deployLoanTokenLogicWrbtc = async () => {
    const loanTokenLogicWrbtc = await LoanTokenLogicWrbtc.new();
    return loanTokenLogicWrbtc;
};

export const deployLoanTokenSettings = async () => {
    const loanSettings = await LoanSettings.new();
    return loanSettings;
};

export const deployLoanToken = async (loanTokenLogicStandard, owner, sovryn, WRBTC, token) => {
    let loanToken = await LoanToken.new(owner, loanTokenLogicStandard.address, sovryn.address, WRBTC.address);
    const symbol = await token.symbol();
    await loanToken.initialize(token.address, `i${symbol}`, `i${symbol}`); //iToken
    loanToken = await LoanTokenLogicStandard.at(loanToken.address);
    // assert loanToken.tokenPrice() == loanToken.initialPrice()
    // const initial_total_supply = await loanToken.totalSupply();
    // loan token total supply should be zero
    // assert initial_total_supply == loanToken.totalSupply()
    return loanToken;
};

export const deployLoanTokenWRBTC = async (loanTokenLogicWrbtc, owner, sovryn, WRBTC) => {
    let loanTokenWRBTC = await LoanToken.new(owner, loanTokenLogicWrbtc.address, sovryn.address, WRBTC.address);
    await loanTokenWRBTC.initialize(WRBTC.address, "iWRBTC", "iWRBTC"); //iToken
    loanTokenWRBTC = await LoanTokenLogicWrbtc.at(loanTokenWRBTC.address);
    // assert loanToken.tokenPrice() == loanToken.initialPrice()
    // const initial_total_supply = await loanToken.totalSupply();
    // loan token total supply should be zero
    // assert initial_total_supply == loanToken.totalSupply()
    return loanTokenWRBTC;
};

export const initLoanPool = async ({
    sovrynProtocol,
    owner,
    wrbtcToken,
    token,
    loanToken,
    loanTokenWrbtc
}) => {
    // old loan_pool_setup
    let params = [];
    let config = [
        "0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
        false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
        owner, // address owner; // owner of this object
        CONSTANTS.ZERO_ADDRESS, // address loanToken; // the token being loaned
        wrbtcToken.address, // address collateralToken; // the required collateral token
        wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
        wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
        0, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
    ];
    params.push(config);
    //const copy1 = [...config];
    //copy1[4] = WRBTC.address;
    //params.push(copy1);

    await loanToken.setupLoanParams(params, false);
    await loanToken.setupLoanParams(params, true);

    params = [];
    const copy2 = [...config];
    copy2[4] = token.address;
    params.push(copy2);

    await loanTokenWrbtc.setupLoanParams(params, false);
    await loanTokenWrbtc.setupLoanParams(params, true);

    await sovrynProtocol.setLoanPool([loanToken.address, loanTokenWrbtc.address], [token.address, wrbtcToken.address]);
};

export const setDemandCurve = async (loanToken, opts = {}) => {
    const {
        baseRate = wei("1", "ether"),
        rateMultiplier = wei("20.25", "ether"),
        targetLevel = wei("80", "ether"),
        kinkLevel = wei("90", "ether"),
        maxScaleRate = wei("100", "ether"),
    } = opts;

    const localLoanToken = await LoanTokenLogicStandard.at(loanToken.address);
    await localLoanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);
    // borrow_interest_rate = loanToken.borrowInterestRate();
    // print("borrowInterestRate: ", borrow_interest_rate);
    // assert(borrow_interest_rate > baseRate);
};

export const lend_to_pool = async (loanToken, SUSD, lender) => {
    const lend_amount = new BN(10).pow(new BN(30)).toString();
    await SUSD.mint(lender, lend_amount);
    await SUSD.approve(loanToken.address, lend_amount);
    await loanToken.mint(lender, lend_amount);
    return [lender, lend_amount];
};

export const lend_to_pool_iBTC = async (loanTokenWRBTC, lender) => {
    const lend_amount = new BN(10).pow(new BN(21)).toString();
    await loanTokenWRBTC.mintWithBTC(lender, { from: lender, value: lend_amount });
    return [lender, lend_amount];
};

export const open_margin_trade_position = async (
    loanToken,
    RBTC,
    WRBTC,
    SUSD,
    trader,
    collateral = "RBTC",
    loan_token_sent = hunEth.toString(),
    leverage_amount = new BN(2).mul(oneEth).toString()
) => {
    await SUSD.mint(trader, loan_token_sent);
    await SUSD.approve(loanToken.address, loan_token_sent, { from: trader });

    let collateralToken;
    if (collateral == "RBTC") collateralToken = RBTC.address;
    else collateralToken = WRBTC.address;

    const { receipt } = await loanToken.marginTrade(
        "0x0", // loanId  (0 for new loans)
        leverage_amount, // leverageAmount
        loan_token_sent, // loanTokenSent
        0, // no collateral token sent
        collateralToken, // collateralTokenAddress
        trader, // trader,
        [], // loanDataBytes (only required with ether)
        { from: trader }
    );
    const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
    return [decode[0].args["loanId"], trader, loan_token_sent, leverage_amount];
};

export const open_margin_trade_position_iBTC = async (
    loanTokenWRBTC,
    SUSD,
    trader,
    loan_token_sent = oneEth.toString(),
    leverage_amount = new BN(2).mul(oneEth).toString()
) => {
    const { receipt } = await loanTokenWRBTC.marginTrade(
        "0x0", // loanId  (0 for new loans)
        leverage_amount, // leverageAmount
        loan_token_sent, // loanTokenSent
        0, // no collateral token sent
        SUSD.address, // collateralTokenAddress
        trader, // trader,
        [], // loanDataBytes (only required with ether)
        { from: trader, value: loan_token_sent }
    );

    const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
    return [decode[0].args["loanId"], trader, loan_token_sent, leverage_amount];
};

export const borrow_indefinite_loan = async (
    loanToken,
    sovryn,
    SUSD,
    RBTC,
    accounts,
    withdraw_amount = new BN(10).mul(oneEth).toString(),
    margin = new BN(50).mul(oneEth).toString(),
    duration_in_seconds = 60 * 60 * 24 * 10
) => {
    const borrower = accounts[2];
    const receiver = accounts[1];
    const collateral_token_sent = await sovryn.getRequiredCollateral(SUSD.address, RBTC.address, withdraw_amount, margin, true);
    // approve the transfer of the collateral
    await RBTC.mint(borrower, collateral_token_sent);
    await RBTC.approve(loanToken.address, collateral_token_sent, { from: borrower });
    // borrow some funds
    const tx = await loanToken.borrow(
        constants.ZERO_BYTES32, // bytes32 loanId
        withdraw_amount, // uint256 withdrawAmount
        duration_in_seconds, // uint256 initialLoanDuration
        collateral_token_sent, // uint256 collateralTokenSent
        RBTC.address, // address collateralTokenAddress
        borrower, // address borrower
        receiver, // address receiver
        "0x", // bytes memory loanDataBytes
        { from: borrower }
    );
    const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Borrow");
    const loan_id = decode[0].args["loanId"];
    return [loan_id, borrower, receiver, withdraw_amount, duration_in_seconds, margin, decode[0].args];
};

export function decodeLogs(logs, emitter, eventName) {
    let abi;
    let address;
    abi = emitter.abi;
    try {
        address = emitter.address;
    } catch (e) {
        address = null;
    }

    let eventABI = abi.filter((x) => x.type === "event" && x.name === eventName);
    if (eventABI.length === 0) {
        throw new Error(`No ABI entry for event '${eventName}'`);
    } else if (eventABI.length > 1) {
        throw new Error(`Multiple ABI entries for event '${eventName}', only uniquely named events are supported`);
    }

    eventABI = eventABI[0];

    // The first topic will equal the hash of the event signature
    const eventSignature = `${eventName}(${eventABI.inputs.map((input) => input.type).join(",")})`;
    const eventTopic = web3.utils.sha3(eventSignature);

    // Only decode events of type 'EventName'
    return logs
        .filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address))
        .map((log) => web3.eth.abi.decodeLog(eventABI.inputs, log.data, log.topics.slice(1)))
        .map((decoded) => ({ event: eventName, args: decoded }));
}

export const verify_sov_reward_payment = async (logs, FeesEvents, SOV, borrower, loan_id, sov_initial_balance, expected_events_number) => {
    const earn_reward_events = decodeLogs(logs, FeesEvents, "EarnReward");
    const len = earn_reward_events.length;
    expect(len).to.equal(expected_events_number);

    let reward = new BN(0);
    for (let i = 0; i < len; i++) {
        const args = earn_reward_events[i].args;
        expect(args["receiver"]).to.equal(borrower);
        expect(args["token"]).to.equal(SOV.address);
        expect(args["loanId"]).to.equal(loan_id);
        reward = reward.add(new BN(args["amount"]));
    }

    expect(await SOV.balanceOf(borrower)).to.be.a.bignumber.equal(sov_initial_balance.add(reward));
};