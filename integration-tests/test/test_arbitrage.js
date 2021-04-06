import conf from '../../config/config';
conf.nodeProvider = 'http://example.invalid';
conf.publicNodeProvider = 'http://example.invalid';
conf.errorBotTelegram = undefined;
conf.db = 'sovryn_node_integration_tests.db';

const { expect } = require("chai");
const { constants, time, BN } = require("@openzeppelin/test-helpers");

const { registry } = require("../oracle-based-amm/solidity/test/helpers/Constants");

const { latest } = time;
const { ZERO_ADDRESS } = constants;

const SovrynSwapNetwork = artifacts.require("SovrynSwapNetwork");
const SovrynSwapFormula = artifacts.require("SovrynSwapFormula");
const ContractRegistry = artifacts.require("ContractRegistry");
const ERC20Token = artifacts.require("ERC20Token");
const ConverterFactory = artifacts.require("ConverterFactory");
const ConverterUpgrader = artifacts.require("ConverterUpgrader");
const ConverterRegistry = artifacts.require("ConverterRegistry");
const ConverterRegistryData = artifacts.require("ConverterRegistryData");

const LiquidityPoolV2Converter = artifacts.require("LiquidityPoolV2Converter");
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

const C = require('../../controller/contract').default;

describe("Arbitrage controller", () => {
    const initConverter = async (opts) => {
        const {
            primaryReserveToken,
            secondaryReserveToken,
            primaryWeight = 500000,
            secondaryWeight = 500000,
            activate = true,
            maxConversionFee = 0,
        } = opts;
        if (!primaryReserveToken || !secondaryReserveToken) {
            throw new Error('primaryReserveToken and secondaryReserveToken are required');
        }
        const anchor = await PoolTokensContainer.new(
            (await primaryReserveToken.name()) + '-' + (await secondaryReserveToken.name()),
            (await primaryReserveToken.symbol()) + (await secondaryReserveToken.symbol()),
            // Not sure what decimals should be. Converter.js test has 2. LiquidityPoolV2Converter.js test has 10.
            // But 18 seems reasonable, since the underlying tokens have 18...
            18
        );

        const converter = await LiquidityPoolV2Converter.new(anchor.address, contractRegistry.address, maxConversionFee);

        await converter.addReserve(primaryReserveToken.address, primaryWeight);
        await converter.addReserve(secondaryReserveToken.address, secondaryWeight);

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();

            await converter.activate(primaryReserveToken.address, chainlinkPriceOraclePrimary.address, chainlinkPriceOracleSecondary.address);
        }

        return converter;
    };

    const createChainlinkOracle = async (answer) => {
        const chainlinkOracle = await ChainlinkPriceOracle.new();
        await chainlinkOracle.setAnswer(answer);
        await chainlinkOracle.setTimestamp(await latest());

        return chainlinkOracle;
    };

    let accounts;
    let accountOwner;
    let accountNonOwner;
    let accountReceiver;

    let sovrynSwapNetwork;
    let factory;
    let contractRegistry;
    let wrbtcToken;
    let docToken;
    let bproToken;
    let usdtToken;
    let rbtcWrapperProxy;
    let upgrader;
    let chainlinkPriceOraclePrimary;
    let chainlinkPriceOracleSecondary;

    before(async () => {
        accounts = await web3.eth.getAccounts();
        accountOwner = accounts[0];
        accountNonOwner = accounts[1];
        accountReceiver = accounts[3];
    });

    beforeEach(async () => {
        // the first part could be moved to before, but doesn't really matter
        contractRegistry = await ContractRegistry.new();

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

        const oracleWhitelist = await Whitelist.new();
        await contractRegistry.registerAddress(registry.CHAINLINK_ORACLE_WHITELIST, oracleWhitelist.address);

        chainlinkPriceOraclePrimary = await createChainlinkOracle(10000);
        chainlinkPriceOracleSecondary = await createChainlinkOracle(20000);

        await oracleWhitelist.addAddress(chainlinkPriceOraclePrimary.address);
        await oracleWhitelist.addAddress(chainlinkPriceOracleSecondary.address);

        // this part cannot be moved to before
        sovrynSwapNetwork = await SovrynSwapNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.SOVRYNSWAP_NETWORK, sovrynSwapNetwork.address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        const converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        docToken = await ERC20Token.new("Dollar on Chain", "DOC", 18, 1000000000);
        usdtToken = await ERC20Token.new("rUSDT", "rUSDT", 18, 1000000000);
        bproToken = await ERC20Token.new("BitPRO", "BITP", 18, 1000000000);
        wrbtcToken = await WRBTC.new();
        await wrbtcToken.deposit({ value: 1000000 });

        rbtcWrapperProxy = await RBTCWrapperProxy.new(wrbtcToken.address, sovrynSwapNetwork.address);

        const converter = await initConverter({
            primaryReserveToken: wrbtcToken,
            secondaryReserveToken: usdtToken
        });
        await converterRegistry.addConverter(converter.address);
        // TODO: should we rather deploy like this:
        //await converterRegistry.newConverter(
        //    2,
        //    "test",
        //    "TST",
        //    2,
        //    1000,
        //    [reserveToken.address, reserveToken2.address],
        //    [500000, 500000]
        //);

        // We need to modify conf, since everything depends on it
        // Maybe we should modify the archtitecture so that this would not be necessary
        conf.swapsImpl = sovrynSwapNetwork.address.toLowerCase();
        conf.docToken = docToken.address.toLowerCase();
        conf.USDTToken = usdtToken.address.toLowerCase();
        conf.BProToken = bproToken.address.toLowerCase();
        conf.testTokenRBTC = wrbtcToken.address.toLowerCase();
        conf.wRbtcWrapper = rbtcWrapperProxy.address.toLowerCase();
        //conf.priceFeed  // TODO: handle this. contract is PriceFeeds, initialize with wbtc and DoC
        //conf.sovrynProtocolAdr  // TODO: handle this, if needed. contract is sovrynProtocol (Protocol.sol)
        // TODO: arbitrager etc addresses

        // THESE are not yet handled
        conf.loanTokenSUSD = ZERO_ADDRESS;
        conf.loanTokenUSDT = ZERO_ADDRESS;
        conf.loanTokenBPRO = ZERO_ADDRESS;
        conf.loanTokenRBTC = ZERO_ADDRESS;

        // Set these just to be safe
        conf.nodeProvider = 'http://example.invalid';
        conf.publicNodeProvider = 'http://example.invalid';
        conf.errorBotTelegram = undefined;

        // Use a different DB too
        conf.db = 'sovryn_node_integration_tests.db';

        // We also need to re-init contracts, since it stores stuff in constructor
        C.init(web3);
    });

    describe('Contract controller', () => {
        it("Should get the liquidity pool", async () => {
            const liquidityPool = await C.getLiquidityPoolByTokens(wrbtcToken.address, usdtToken.address);
            const contractPrimaryToken = await liquidityPool.methods.primaryReserveToken().call();
            expect(contractPrimaryToken.toLowerCase()).to.equal(wrbtcToken.address.toLowerCase());
            const balance1 = await liquidityPool.methods.reserveStakedBalance(wrbtcToken.address).call();
            const balance2 = await liquidityPool.methods.reserveStakedBalance(usdtToken.address).call();
            console.log('balances', balance1, balance2);
            //const weights = await liquidityPool.methods.effectiveReserveWeights().call();
            //console.log('weights', weights);
        });
    });
});
