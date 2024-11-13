const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {
    // Deploy AtomicSwap contract, passing WETH if necessary
    const Commitment = m.contract("MinerCommitmentTracker", []); // Deploy WETH
    // Return the deployed contracts
    return {
      Commitment,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});

