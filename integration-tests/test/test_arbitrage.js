import conf from '../../config/config';
conf.nodeProvider = 'http://example.invalid';
conf.publicNodeProvider = 'http://example.invalid';

const { expect } = require("chai");
const { constants, time } = require("@openzeppelin/test-helpers");

const { ETH_RESERVE_ADDRESS, registry } = require("../oracle-based-amm/solidity/test/helpers/Constants");

const { latest } = time;
const { ZERO_ADDRESS } = constants;

const SovrynSwapNetwork = artifacts.require("SovrynSwapNetwork");
const SovrynSwapFormula = artifacts.require("SovrynSwapFormula");
const ContractRegistry = artifacts.require("ContractRegistry");
const ERC20Token = artifacts.require("ERC20Token");
const TestNonStandardToken = artifacts.require("TestNonStandardToken");
const ConverterFactory = artifacts.require("ConverterFactory");
const ConverterUpgrader = artifacts.require("ConverterUpgrader");
const ConverterRegistry = artifacts.require("ConverterRegistry");
const ConverterRegistryData = artifacts.require("ConverterRegistryData");

const LiquidTokenConverter = artifacts.require("LiquidTokenConverter");
const LiquidityPoolV1Converter = artifacts.require("LiquidityPoolV1Converter");
const LiquidityPoolV2Converter = artifacts.require("LiquidityPoolV2Converter");
const LiquidTokenConverterFactory = artifacts.require("LiquidTokenConverterFactory");
const LiquidityPoolV1ConverterFactory = artifacts.require("LiquidityPoolV1ConverterFactory");
const LiquidityPoolV2ConverterFactory = artifacts.require("LiquidityPoolV2ConverterFactory");
const LiquidityPoolV2ConverterAnchorFactory = artifacts.require("LiquidityPoolV2ConverterAnchorFactory");
const LiquidityPoolV2ConverterCustomFactory = artifacts.require("LiquidityPoolV2ConverterCustomFactory");
const SmartToken = artifacts.require("SmartToken");
const PoolTokensContainer = artifacts.require("PoolTokensContainer");
const ChainlinkPriceOracle = artifacts.require("TestChainlinkPriceOracle");
const Whitelist = artifacts.require("Whitelist");

const C = require('../../controller/contract').default;

describe("Arbitrage controller", () => {
    const createConverter = async (type, anchorAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
        switch (type) {
            case 0:
                return LiquidTokenConverter.new(anchorAddress, registryAddress, maxConversionFee);
            case 1:
                return LiquidityPoolV1Converter.new(anchorAddress, registryAddress, maxConversionFee);
            case 2:
                return LiquidityPoolV2Converter.new(anchorAddress, registryAddress, maxConversionFee);
        }
    };

    const getConverterReserveAddresses = (type, isETHReserve) => {
        switch (type) {
            case 0:
                return [getReserve1Address(isETHReserve)];
            case 1:
                return [getReserve1Address(isETHReserve), reserveToken2.address];
            case 2:
                return [getReserve1Address(isETHReserve), reserveToken2.address];
        }

        return "Unknown";
    };

    const getConverterReserveWeights = (type) => {
        switch (type) {
            case 0:
                return [250000];
            case 1:
                return [250000, 150000];
            case 2:
                return [500000, 500000];
        }

        return "Unknown";
    };

    const initConverter = async (type, activate, isETHReserve, maxConversionFee = 0) => {
        await createAnchor(type);
        const reserveAddresses = getConverterReserveAddresses(type, isETHReserve);
        const reserveWeights = getConverterReserveWeights(type);

        const converter = await createConverter(type, anchorAddress, contractRegistry.address, maxConversionFee);

        for (let i = 0; i < reserveAddresses.length; i++) {
            await converter.addReserve(reserveAddresses[i], reserveWeights[i]);
        }

        switch (type) {
            case 0:
                await anchor.issue(owner, 20000);
                break;

            case 1:
                await reserveToken2.transfer(converter.address, 8000);
                await anchor.issue(owner, 20000);
                break;

            case 2:
                await reserveToken2.transfer(converter.address, 8000);
                break;
        }

        if (isETHReserve) {
            await converter.send(5000);
        } else {
            await reserveToken.transfer(converter.address, 5000);
        }

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();

            if (type === 2) {
                await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
            }
        }

        return converter;
    };

    const createAnchor = async (type) => {
        switch (type) {
            case 0:
                anchor = await SmartToken.new("Token1", "TKN1", 2);
                break;

            case 1:
                anchor = await SmartToken.new("Pool1", "POOL1", 2);
                break;

            case 2:
                anchor = await PoolTokensContainer.new("Pool", "POOL", 2);
                break;
        }

        anchorAddress = anchor.address;
    };

    const getReserve1Address = (isETH) => {
        return isETH ? ETH_RESERVE_ADDRESS : reserveToken.address;
    };

    const createChainlinkOracle = async (answer) => {
        const chainlinkOracle = await ChainlinkPriceOracle.new();
        await chainlinkOracle.setAnswer(answer);
        await chainlinkOracle.setTimestamp(await latest());

        return chainlinkOracle;
    };

    let accounts;
    let sovrynSwapNetwork;
    let factory;
    let anchor;
    let anchorAddress;
    let contractRegistry;
    let reserveToken;
    let reserveToken2;
    let upgrader;
    let chainlinkPriceOracleA;
    let chainlinkPriceOracleB;
    let owner;
    let nonOwner;
    let receiver;

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

        reserveToken = await ERC20Token.new("ERC Token 1", "ERC1", 18, 1000000000);
        reserveToken2 = await TestNonStandardToken.new("ERC Token 2", "ERC2", 18, 2000000000);

        const converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        const converterType = 2; // LiquidityPoolV2Converter
        const converter = await initConverter(converterType, true, false);
        await converterRegistry.addConverter(converter.address);
        //await converterRegistry.newConverter(
        //    converterType,
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
            const liquidityPool = await C.getLiquidityPoolByTokens(reserveToken.address, reserveToken2.address);
            const contractPrimaryToken = await liquidityPool.methods.primaryReserveToken().call();
            expect(contractPrimaryToken.toLowerCase()).to.equal(reserveToken.address.toLowerCase());
        });
    });
});
