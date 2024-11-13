const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {
    // Deploy two factories
    const feeToSetterAddress = '0x589A698b7b7dA0Bec545177D3963A2741105C7C9';

    const UniV2FactoryB = m.contract(
      "UniswapV2Factory",
      [feeToSetterAddress],
      { id: "UniV2FactoryB" }
    );

    // Return the deployed contracts
    return {
      UniV2FactoryB,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});

