const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {
    // Deploy tokens
    const DAI = m.contract("Dai", [3151908]); // Assign a unique ID

    // Deploy two factories
    const feeToSetterAddress = '0x589A698b7b7dA0Bec545177D3963A2741105C7C9';

    const UniV2FactoryA = m.contract(
      "UniswapV2Factory",
      [feeToSetterAddress],
      { id: "UniV2FactoryA" }
    );
    const UniV2FactoryB = m.contract(
      "UniswapV2Factory",
      [feeToSetterAddress],
      { id: "UniV2FactoryB" }
    );

    // Deploy AtomicSwap contract, passing WETH if necessary
    const AtomicSwap = m.contract("AtomicSwap", [WETH], { id: "AtomicSwap" });

    // Deploy UniswapV2Router01, passing UniV2FactoryA and WETH
    const UniV2Router = m.contract(
      "UniswapV2Router01",
      [UniV2FactoryA, WETH], // Pass contract instances, not addresses
      { id: "UniV2Router" }
    );

    // Return the deployed contracts
    return {
      DAI,
      WETH,
      UniV2FactoryA,
      UniV2FactoryB,
      AtomicSwap,
      UniV2Router,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});

