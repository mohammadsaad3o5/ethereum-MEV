const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {
    // Deploy AtomicSwap contract, passing WETH if necessary
    const WETH = m.contract("WETH9", []); // Deploy WETH
    const AtomicSwap = m.contract("AtomicSwap", [WETH], { id: "AtomicSwap" });
    // Return the deployed contracts
    return {
      AtomicSwap,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});

