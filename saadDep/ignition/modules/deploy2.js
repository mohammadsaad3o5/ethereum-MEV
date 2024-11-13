const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {
    // Deploy tokens
    const WETH = m.contract("WETH9", []); // Deploy WETH

    // Return the deployed contracts
    return {
      WETH,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});

