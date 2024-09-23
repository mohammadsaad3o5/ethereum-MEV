// interact.js


const PRIVATE_KEY = "eaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";
const CONTRACT_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9";
const { ethers } = require('ethers'); // Destructure ethers to make utils available

const contract = require("/home/ubuntu/ethereum-MEV/saadDep/artifacts/contracts/DAI.sol/Dai.json");

const alchemyProvider = new ethers.JsonRpcProvider("http://localhost:32783");

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

// contract instance
const DaiContract = new ethers.Contract(CONTRACT_ADDRESS, contract.abi, signer);

async function main() {
    // console.log(DaiContract); 
    let tx = await DaiContract.mint("0x589a698b7b7da0bec545177d3963a2741105c7c9", "11110");
    console.log(tx);
}

main();