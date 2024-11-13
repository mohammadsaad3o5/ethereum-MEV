const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {
    // Deploy tokens
    const DAI = m.contract("Dai", [3151908]); // Assign a unique ID
    // Return the deployed contracts
    return {
      DAI,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});

