// For Hardhat 
const contract = require("/home/ubuntu/ethereum-MEV/saad/ignition/deployments/chain-3151908/artifacts/TokenModule#Token.json");

console.log(JSON.stringify(contract.abi));
const { ethers } = require('ethers'); // Import ethers




// Provider
const alchemyProvider = new ethers.JsonRpcProvider("http://localhost:32783");
// Signer
const signer = new ethers.Wallet("0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23", alchemyProvider);
// Contract
const tokenContract = new ethers.Contract("0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9", contract.abi, signer);


async function main() {
    const message = await tokenContract.balanceOf("0x589a698b7b7da0bec545177d3963a2741105c7c9");
    console.log("Balance: " + message);
  }
  
main();