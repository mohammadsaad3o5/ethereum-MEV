const { buildModule } = require("@nomicfoundation/hardhat-ignition");

module.exports = buildModule("UniswapV2Deployment", async (deployer, options) => {
  // Deploy ERC20 tokens (DAI, WETH)
  const DAI = await deployer.deploy("DAI", [options.chainId]); // DAI with chainId
  const WETH = await deployer.deploy("WETH"); // WETH has no constructor args

  // Deploy UniswapV2 factories (Factory A and Factory B)
  const UniV2FactoryA = await deployer.deploy("UniswapV2Factory", [options.adminAddress]);
  const UniV2FactoryB = await deployer.deploy("UniswapV2Factory", [options.adminAddress]);

  // Deploy custom AtomicSwap router
  const AtomicSwap = await deployer.deploy("AtomicSwap", [WETH.address]);

  // Create pairs in both factories (DAI/WETH pair in both)
  const createPairA = await UniV2FactoryA.createPair(DAI.address, WETH.address);
  const createPairB = await UniV2FactoryB.createPair(DAI.address, WETH.address);

  // Mint DAI and WETH tokens
  const mintAmount = options.mintAmount || "1000000000000000000000"; // 1000 tokens
  await DAI.mint(options.adminAddress, mintAmount);
  await WETH.deposit({ value: mintAmount, from: options.adminAddress });

  // Approve tokens for trading with the AtomicSwap router
  await DAI.approve(AtomicSwap.address, constants.MaxUint256);
  await WETH.approve(AtomicSwap.address, constants.MaxUint256);

  // Bootstrap liquidity into the pair
  const DAIAmount = mintAmount;
  const WETHAmount = mintAmount.div(1300); // Assuming 1300 DAI/WETH
  await AtomicSwap.addLiquidity(DAI.address, WETH.address, DAIAmount, WETHAmount, {
    from: options.adminAddress
  });

  return {
    DAI,
    WETH,
    UniV2FactoryA,
    UniV2FactoryB,
    AtomicSwap,
    PairA: createPairA,
    PairB: createPairB,
  };
});
