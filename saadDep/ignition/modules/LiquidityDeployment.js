// const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
// const { constants, BigNumber } = require("ethers");

// module.exports = buildModule("LiquidDeployment", (m) => {
//     // Deploy ERC20 tokens (DAI, WETH)
//     const DAI =  m.contract("Dai", [3151908]);

//     return {DAI}
// });

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LiquidDeployment", (m) => {
  try {

    // Deploy tokens
    const DAI = m.contract("Dai", [3151908]); // Assign a unique ID
    const WETH = m.contract("WETH9", []); // Assign a unique ID

    // Deploy two factories
    const feeToSetterAddress = '0x589A698b7b7dA0Bec545177D3963A2741105C7C9'; 

    const UniV2FactoryA = m.contract(
    "UniswapV2Factory", [feeToSetterAddress], { id: "UniV2FactoryA" } 
    );
    const UniV2FactoryB = m.contract(
    "UniswapV2Factory", [feeToSetterAddress], { id: "UniV2FactoryB" } 
    );
    
    // Deploy atomicSwap as router
    const AtomicSwap = m.contract("AtomicSwap", ["0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"], { id: "AtomicSwap" });

    // const DAI_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0";   
    // const WETH_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3";  

    return {
      DAI,
      WETH,
      UniV2FactoryA,
      UniV2FactoryB,
      AtomicSwap,
    };
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
});
