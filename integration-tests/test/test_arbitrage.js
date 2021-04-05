import conf from '../../config/config';
conf.nodeProvider = 'http://example.invalid';
conf.publicNodeProvider = 'http://example.invalid';
conf.errorBotTelegram = undefined;
conf.db = 'sovryn_node_integration_tests.db';

const { expect } = require("chai");
const { constants, time } = require("@openzeppelin/test-helpers");

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

const C = require('../../controller/contract').default;

describe("Arbitrage controller", () => {
    const newConverter = async (reserveToken1, reserveToken2, activate = true, maxConversionFee = 0) => {
        const anchor = await PoolTokensContainer.new(
            "Pool",
            "POOL",
            2  // really 2? should it not be 18?
        );
        const reserveAddresses = [reserveToken1.address, reserveToken2.address];
        const reserveWeights = [500000, 500000];

        const converter = await LiquidityPoolV2Converter.new(anchor.address, contractRegistry.address, maxConversionFee);

        for (let i = 0; i < reserveAddresses.length; i++) {
            await converter.addReserve(reserveAddresses[i], reserveWeights[i]);
        }

        await reserveToken1.transfer(converter.address, 5000);
        await reserveToken2.transfer(converter.address, 8000);

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();

            await converter.activate(reserveToken1.address, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
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
    let owner;
    let nonOwner;
    let receiver;

    let sovrynSwapNetwork;
    let factory;
    let contractRegistry;
    let wrbtcToken;
    let docToken;
    let bproToken;
    let usdtToken;
    let wrbtcWrapper;  // TODO
    let upgrader;
    let chainlinkPriceOracleA;
    let chainlinkPriceOracleB;

    before(async () => {
        accounts = await web3.eth.getAccounts();
        owner = accounts[0];
        nonOwner = accounts[1];
        receiver = accounts[3];
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

        chainlinkPriceOracleA = await createChainlinkOracle(10000);
        chainlinkPriceOracleB = await createChainlinkOracle(20000);

        await oracleWhitelist.addAddress(chainlinkPriceOracleA.address);
        await oracleWhitelist.addAddress(chainlinkPriceOracleB.address);

        // this part cannot be moved to before
        sovrynSwapNetwork = await SovrynSwapNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.SOVRYNSWAP_NETWORK, sovrynSwapNetwork.address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        docToken = await ERC20Token.new("Dollar on Chain", "DOC", 18, 1000000000);
        usdtToken = await ERC20Token.new("USDT", "USDT", 18, 1000000000);
        bproToken = await ERC20Token.new("BPro", "BPRO", 18, 1000000000);
        wrbtcToken = await ERC20Token.new("Wrapped BTC", "WRBTC", 18, 1000000000);

        const converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        const converter = await newConverter(wrbtcToken, usdtToken);
        await converterRegistry.addConverter(converter.address);
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
        conf.swapsImpl = sovrynSwapNetwork.address.toLowerCase();
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
