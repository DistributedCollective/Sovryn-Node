const { constants, time, BN } = require("@openzeppelin/test-helpers");

const { registry } = require("../../oracle-based-amm/solidity/test/helpers/Constants");

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


/**
 * Deploy the contracts required to use Sovryn.
 *
 * Does not deploy converters but instead provides a helper (initConverter) to do the deployment.
 *
 * @returns {Promise<any>} An object containing deployed contracts, web3 addresses, and helpers
 */
export async function initSovrynContracts() {
    const initConverter = async (opts) => {
        const {
            primaryReserveToken,
            secondaryReserveToken,
            primaryReserveWeight = 500000,
            secondaryReserveWeight = 500000,
            activate = true,
            register = true,
            maxConversionFee = 0,
            initialPrimaryReserveLiquidity = null,
            initialSecondaryReserveLiquidity = null,
            minReturn = new BN(1),
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

        await converter.addReserve(primaryReserveToken.address, primaryReserveWeight);
        await converter.addReserve(secondaryReserveToken.address, secondaryReserveWeight);

        if(activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();

            await converter.activate(primaryReserveToken.address, chainlinkPriceOraclePrimary.address, chainlinkPriceOracleSecondary.address);
        }

        if(register) {
            await converterRegistry.addConverter(converter.address);
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

        return converter;
    };

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
    let usdtToken;
    let rbtcWrapperProxy;
    let upgrader;
    let chainlinkPriceOraclePrimary;
    let chainlinkPriceOracleSecondary;

    accounts = await web3.eth.getAccounts();
    accountOwner = accounts[0];
    accountNonOwner = accounts[1];
    accountReceiver = accounts[3];

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
    chainlinkPriceOracleSecondary = await createChainlinkOracle(10000);

    await oracleWhitelist.addAddress(chainlinkPriceOraclePrimary.address);
    await oracleWhitelist.addAddress(chainlinkPriceOracleSecondary.address);

    // this part cannot be moved to before
    sovrynSwapNetwork = await SovrynSwapNetwork.new(contractRegistry.address);
    await contractRegistry.registerAddress(registry.SOVRYNSWAP_NETWORK, sovrynSwapNetwork.address);

    upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

    converterRegistry = await ConverterRegistry.new(contractRegistry.address);
    const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

    await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
    await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

    docToken = await ERC20Token.new("Dollar on Chain", "DOC", 18, 1000000000);
    usdtToken = await ERC20Token.new("rUSDT", "rUSDT", 18, 1000000000);
    bproToken = await ERC20Token.new("BitPRO", "BITP", 18, 1000000000);
    wrbtcToken = await WRBTC.new();
    await wrbtcToken.deposit({ value: 1000000000000000 });

    rbtcWrapperProxy = await RBTCWrapperProxy.new(wrbtcToken.address, sovrynSwapNetwork.address);

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
        rbtcWrapperProxy,
        upgrader,
        chainlinkPriceOraclePrimary,
        chainlinkPriceOracleSecondary,

        initConverter,
    };
}

const createChainlinkOracle = async (answer) => {
    const chainlinkOracle = await ChainlinkPriceOracle.new();
    await chainlinkOracle.setAnswer(answer);
    await chainlinkOracle.setTimestamp(await latest());

    return chainlinkOracle;
};

