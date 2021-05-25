const { constants, time, BN, ether } = require("@openzeppelin/test-helpers");

const { registry } = require("../../oracle-based-amm/solidity/test/helpers/Constants");

const { latest, duration } = time;
const { ZERO_ADDRESS, MAX_UINT256 } = constants;

const SovrynSwapNetwork = artifacts.require("SovrynSwapNetwork");
const SovrynSwapFormula = artifacts.require("SovrynSwapFormula");
const ContractRegistry = artifacts.require("ContractRegistry");
const ERC20Token = artifacts.require("ERC20Token");
const ConverterFactory = artifacts.require("ConverterFactory");
const ConverterUpgrader = artifacts.require("ConverterUpgrader");
const ConverterRegistry = artifacts.require("ConverterRegistry");
const ConverterRegistryData = artifacts.require("ConverterRegistryData");
const ConversionPathFinder = artifacts.require("ConversionPathFinder");

// NOTE: we use our custom test version of LiquidityPoolV2Converter since that augments it with useful testing methods
const LiquidityPoolV2Converter = artifacts.require("ImprovedTestLiquidityPoolV2Converter");

const LiquidTokenConverterFactory = artifacts.require("LiquidTokenConverterFactory");
const LiquidityPoolV1ConverterFactory = artifacts.require("LiquidityPoolV1ConverterFactory");
const LiquidityPoolV2ConverterFactory = artifacts.require("LiquidityPoolV2ConverterFactory");
const LiquidityPoolV2ConverterAnchorFactory = artifacts.require("LiquidityPoolV2ConverterAnchorFactory");
const LiquidityPoolV2ConverterCustomFactory = artifacts.require("LiquidityPoolV2ConverterCustomFactory");
const PoolTokensContainer = artifacts.require("PoolTokensContainer");
const ChainlinkPriceOracle = artifacts.require("TestChainlinkPriceOracle");
const Whitelist = artifacts.require("Whitelist");

const WRBTC = artifacts.require("WRBTC");
const RBTCWrapperProxy = artifacts.require("RBTCWrapperProxy");
const PriceFeeds = artifacts.require("PriceFeeds");

const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");

import {deployLoanToken, deployLoanTokenLogic, deployLoanTokenLogicWrbtc, deployLoanTokenWRBTC, deploySovrynProtocol} from "./loans";


/**
 * Deploy the contracts required to use Sovryn.
 *
 * Does not deploy converters. Use ConverterHelper to deploy those with ease.
 *
 * @returns {Promise<any>} An object containing deployed contracts web3 addresses
 */
export async function initSovrynContracts() {
    let accounts;
    let accountOwner;
    let accountNonOwner;
    let accountReceiver;

    let sovrynSwapNetwork;
    let factory;
    let contractRegistry;
    let converterRegistry;
    let wrbtcToken;
    let docToken;
    let bproToken;
    let ethsToken;
    let usdtToken;
    let rbtcWrapperProxy;
    let upgrader;
    let oracleWhitelist;

    accounts = await web3.eth.getAccounts();
    accountOwner = accounts[0];
    accountNonOwner = accounts[1];
    accountReceiver = accounts[3];

    // the first part would not need to be initialized for each test run, but it doesn't really matter
    // we can later cache it if tests take too long
    contractRegistry = await ContractRegistry.new();
    await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, contractRegistry.address);

    const sovrynSwapFormula = await SovrynSwapFormula.new();
    await sovrynSwapFormula.init();
    await contractRegistry.registerAddress(registry.SOVRYNSWAP_FORMULA, sovrynSwapFormula.address);

    factory = await ConverterFactory.new();
    await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

    await factory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
    await factory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
    await factory.registerTypedConverterFactory((await LiquidityPoolV2ConverterFactory.new()).address);

    await factory.registerTypedConverterAnchorFactory((await LiquidityPoolV2ConverterAnchorFactory.new()).address);
    await factory.registerTypedConverterCustomFactory((await LiquidityPoolV2ConverterCustomFactory.new()).address);

    oracleWhitelist = await Whitelist.new();
    await contractRegistry.registerAddress(registry.CHAINLINK_ORACLE_WHITELIST, oracleWhitelist.address);

    // this part must be re-initialized for each test run
    sovrynSwapNetwork = await SovrynSwapNetwork.new(contractRegistry.address);
    await contractRegistry.registerAddress(registry.SOVRYNSWAP_NETWORK, sovrynSwapNetwork.address);

    upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

    converterRegistry = await ConverterRegistry.new(contractRegistry.address);
    const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

    await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
    await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

    const pathFinder = await ConversionPathFinder.new(contractRegistry.address);
    await contractRegistry.registerAddress(registry.CONVERSION_PATH_FINDER, pathFinder.address);

    //const tokenSupply = ether('1000000000'); // should be enough for most use cases :P
    const tokenSupply = new BN(10).pow(new BN(50));

    // TODO: not sure if BNT token is needed
    //const bntToken = await ERC20Token.new("BNT", "BNT", 18, tokenSupply);
    //await contractRegistry.registerAddress(registry.BNT_TOKEN, bntToken.address);
    //await pathFinder.setAnchorToken(bntToken.address);

    docToken = await TestToken.new("Dollar on Chain", "DOC", 18, tokenSupply);
    usdtToken = await TestToken.new("rUSDT", "rUSDT", 18, tokenSupply);
    bproToken = await TestToken.new("BitPRO", "BITP", 18, tokenSupply);
    ethsToken = await TestToken.new("ETHs", "ETHs", 18, tokenSupply);
    wrbtcToken = await TestWrbtc.new();
    await wrbtcToken.deposit({ value: ether('1000000000') });  // note: different than tokenSupply
    const tokens = [docToken, usdtToken, bproToken, wrbtcToken];


    // not sure if required
    await contractRegistry.registerAddress(web3.utils.asciiToHex("RBTCToken"), wrbtcToken.address);

    // this is absolutely required, otherwise conversionPath results in an infinite loop
    await pathFinder.setAnchorToken(wrbtcToken.address);

    rbtcWrapperProxy = await RBTCWrapperProxy.new(wrbtcToken.address, sovrynSwapNetwork.address);

    for(let token of [docToken, usdtToken, bproToken, ethsToken, wrbtcToken]) {
        // approve everything for these accounts, for ease
        await token.approve(sovrynSwapNetwork.address, MAX_UINT256, { from: accountOwner });
        await token.approve(sovrynSwapNetwork.address, MAX_UINT256, { from: accountNonOwner });
        await token.approve(sovrynSwapNetwork.address, MAX_UINT256, { from: accountReceiver });
    }
    // approval for accounts[0] not needed
    //await wrbtcToken.approve(rbtcWrapperProxy.address, MAX_UINT256);

    const priceOraclesByTokenAddress = {}
    const priceOracles = []
    for(let token of tokens) {
        const priceOracle = await createChainlinkOracle(ether('1'));
        await oracleWhitelist.addAddress(priceOracle.address);
        priceOraclesByTokenAddress[token.address] = priceOracle;
        priceOracles.push(priceOracle);
    }

    /// XXX: The priceFeeds contract is weird
    // - protocol token is needed and must be a contract, but is apparently not *really* used in practice
    // - base token is DoC (in production)
    const protocolToken = await TestToken.new("Protocol Token", "PROTOCOL", 18, tokenSupply);
    const priceFeeds = await PriceFeeds.new(wrbtcToken.address, protocolToken.address, docToken.address);
    await priceFeeds.setPriceFeed(
        tokens.map(t => t.address),
        priceOracles.map(p => p.address)
    );

    // loans
    // What is the RBTC token?
    const rbtcTokenForLoans = await TestToken.new(
        "RBTC",
        "RBTC",
        18,
        tokenSupply
    );
    const sovrynProtocol = await deploySovrynProtocol({
        wrbtcToken,
        usdtToken,
        docToken,
        bproToken,
        priceFeeds,
        contractRegistry,
    });
    const loanTokenLogicWrbtc = await deployLoanTokenLogicWrbtc();
    const loanTokenWrbtc = await deployLoanTokenWRBTC(loanTokenLogicWrbtc, accountOwner, sovrynProtocol, wrbtcToken, docToken);
    const loanTokenDoc = await deployLoanToken(await deployLoanTokenLogic(), accountOwner, sovrynProtocol, wrbtcToken, docToken);
    const loanTokenUsdt = await deployLoanToken(await deployLoanTokenLogic(), accountOwner, sovrynProtocol, wrbtcToken, usdtToken);
    const loanTokenBpro = await deployLoanToken(await deployLoanTokenLogic(), accountOwner, sovrynProtocol, wrbtcToken, bproToken);
    // TODO: should this be against dollar or btc?
    const loanTokenEths = await deployLoanToken(await deployLoanTokenLogic(), accountOwner, sovrynProtocol, wrbtcToken, ethsToken);

    return {
        accounts,
        accountOwner,
        accountNonOwner,
        accountReceiver,
        sovrynSwapNetwork,
        factory,
        contractRegistry,
        converterRegistry,
        wrbtcToken,
        docToken,
        bproToken,
        usdtToken,
        ethsToken,
        rbtcWrapperProxy,
        upgrader,
        oracleWhitelist,
        priceFeeds,

        sovrynProtocol,
        loanTokenWrbtc,
        loanTokenDoc,
        loanTokenUsdt,
        loanTokenBpro,
        loanTokenEths,

        priceOraclesByTokenAddress,
    };
}

export class ConverterHelper {
    constructor({
        sovrynSwapNetwork,
        contractRegistry,
        converterRegistry,
        oracleWhitelist,
        priceOraclesByTokenAddress,
    }) {
        this.sovrynSwapNetwork = sovrynSwapNetwork;
        this.contractRegistry = contractRegistry;
        this.converterRegistry = converterRegistry;
        this.oracleWhitelist = oracleWhitelist;
        this.priceOraclesByTokenAddress = priceOraclesByTokenAddress;
        this.now = null;
        this.initialized = false;
    }

    async init() {
        if(this.initialized) {
            return;
        }
        // we need to store the current time to set sane reference rates for price oracles
        this.now = await latest();
        this.initialized = true;
    }

    async initConverter(opts) {
        const {
            primaryReserveToken,
            secondaryReserveToken,
            initialPrimaryReserveWeight = 500000,
            initialSecondaryReserveWeight = 500000,
            activate = true,
            register = true,
            maxConversionFee = 0,
            initialPrimaryReserveLiquidity = null,
            initialSecondaryReserveLiquidity = null,
            minReturn = new BN(1),
            finalPrimaryReserveBalance = null,
            finalSecondaryReserveBalance = null,
            finalPrimaryReserveWeight = null,
            finalSecondaryReserveWeight = null,
            primaryPriceOracleAnswer = null,
            secondaryPriceOracleAnswer = null,
        } = opts;
        if (!primaryReserveToken || !secondaryReserveToken) {
            throw new Error('primaryReserveToken and secondaryReserveToken are required');
        }
        await this.init();

        const anchor = await PoolTokensContainer.new(
            'Pool-' + (await primaryReserveToken.name()) + '-' + (await secondaryReserveToken.name()),
            (await primaryReserveToken.symbol()) + (await secondaryReserveToken.symbol()),
            18
        );

        const converter = await LiquidityPoolV2Converter.new(anchor.address, this.contractRegistry.address, maxConversionFee);

        await converter.addReserve(primaryReserveToken.address, initialPrimaryReserveWeight);
        await converter.addReserve(secondaryReserveToken.address, initialSecondaryReserveWeight);

        const primaryChainlinkPriceOracle = this.priceOraclesByTokenAddress[primaryReserveToken.address];
        const secondaryChainlinkPriceOracle = this.priceOraclesByTokenAddress[secondaryReserveToken.address];
        if (!primaryChainlinkPriceOracle || !secondaryChainlinkPriceOracle) {
            throw new Error('price oracle not found for primary or secondary reserve token');
        }

        if(activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();

            await converter.activate(
                primaryReserveToken.address,
                primaryChainlinkPriceOracle.address,
                secondaryChainlinkPriceOracle.address
            );
        }

        if(register) {
            await this.converterRegistry.addConverter(converter.address);
        }

        if(initialPrimaryReserveLiquidity || initialSecondaryReserveLiquidity) {
            if(!initialPrimaryReserveLiquidity || !initialSecondaryReserveLiquidity) {
                throw new Error(
                    'provide both initialPrimaryReserveLiquidity and initialSecondaryReserveLiquidity, ' +
                    'or neither'
                );
            }
            await primaryReserveToken.approve(converter.address, initialPrimaryReserveLiquidity);
            await converter.addLiquidity(primaryReserveToken.address, initialPrimaryReserveLiquidity, minReturn);

            await secondaryReserveToken.approve(converter.address, initialSecondaryReserveLiquidity);
            await converter.addLiquidity(secondaryReserveToken.address, initialSecondaryReserveLiquidity, minReturn);
        }

        if(finalPrimaryReserveBalance !== null) {
            await primaryReserveToken.approve(converter.address, MAX_UINT256);
            await converter.setReserveBalance(primaryReserveToken.address, finalPrimaryReserveBalance);
        }
        if(finalSecondaryReserveBalance !== null) {
            await secondaryReserveToken.approve(converter.address, MAX_UINT256);
            await converter.setReserveBalance(secondaryReserveToken.address, finalSecondaryReserveBalance);
        }
        if(finalPrimaryReserveWeight !== null) {
            await converter.setReserveWeight(primaryReserveToken.address, finalPrimaryReserveWeight);
        }
        if(finalSecondaryReserveWeight !== null) {
            await converter.setReserveWeight(secondaryReserveToken.address, finalSecondaryReserveWeight);
        }

        const now = this.now;
        if(primaryPriceOracleAnswer || secondaryPriceOracleAnswer) {
            if(primaryPriceOracleAnswer) {
                await primaryChainlinkPriceOracle.setTimestamp(now);
                await primaryChainlinkPriceOracle.setAnswer(primaryPriceOracleAnswer);
            }
            if(secondaryPriceOracleAnswer) {
                await secondaryChainlinkPriceOracle.setTimestamp(now);
                await secondaryChainlinkPriceOracle.setAnswer(secondaryPriceOracleAnswer);
            }
            await converter.updateRateAndTimeFromPriceOracle();
        } else {
            // even when oracle prices are not given in initialization, set timestamps so that latest prices
            // are taken into account when converting.
            // this is frail. internal methods manipulate this thing so we need to do it at the very end of this method
            // and there's no quarantee it won't break again
            await converter.setTime(now);
            await converter.setReferenceRateUpdateTime(now.sub(duration.seconds(1)));
        }

        return converter;
    }

    async setOraclePrice(tokenAddress, price) {
        const oracle = this.priceOraclesByTokenAddress[tokenAddress];
        if(!oracle) {
            throw new Error(`oracle not found for token ${tokenAddress}`);
        }
        await this.init();
        await oracle.setTimestamp(this.now);
        await oracle.setAnswer(price);
    }

    async updateChainlinkOracle(converter, oracle, answer) {
        await this.init();
        await oracle.setAnswer(answer);
        await oracle.setTimestamp(this.now);

        await converter.setReferenceRateUpdateTime(this.now.sub(duration.seconds(1)));
    }

    async convert(sourceToken, destToken, amount, additionalOptions = {}) {
        // tokens can be given as contracts or addresses
        sourceToken = typeof sourceToken === 'string' ? sourceToken : sourceToken.address;
        destToken = typeof destToken === 'string' ? destToken : destToken.address;

        const {
            minReturn = new BN(1),
            beneficiary = ZERO_ADDRESS,
            affiliateAccount = ZERO_ADDRESS,
            affiliateFee = 0,
            from = undefined,
        } = additionalOptions;

        const path = await this.sovrynSwapNetwork.conversionPath.call(sourceToken, destToken);
        const args = [
            path,
            amount,
            minReturn,
            beneficiary,
            affiliateAccount,
            affiliateFee,
        ];
        if(from) {
            args.push({ from });
        }
        return await this.sovrynSwapNetwork.convertByPath(...args);
    }
}

const createChainlinkOracle = async (answer) => {
    const chainlinkOracle = await ChainlinkPriceOracle.new();
    await chainlinkOracle.setAnswer(answer);

    // Set the last update time to a far enough future in order for the external oracle price to always take effect.
    await chainlinkOracle.setTimestamp((await latest()).add(duration.years(1)));

    return chainlinkOracle;
}