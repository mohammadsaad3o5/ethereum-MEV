const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {
    // Deploy two factories
    const feeToSetterAddress = '0x589A698b7b7dA0Bec545177D3963A2741105C7C9';

    const UniV2FactoryA = m.contract(
      "UniswapV2Factory",
      [feeToSetterAddress],
      { id: "UniV2FactoryA" }
    );

    // Return the deployed contracts
    return {
      UniV2FactoryA,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});

