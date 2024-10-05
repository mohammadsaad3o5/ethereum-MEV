const {ethers} = require('hardhat');
const path = require("path");
const hardhatConfig = require(path.resolve(__dirname, "../hardhat.config.js"));
const fs = require('fs').promises;

// Reset
const reset = "\x1b[0m";

// Regular Colors
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";


// Contract ABIs and addresses
const DAI_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"; 
const WETH_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C";
const UniV2FactoryA_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
const UniV2FactoryB_ADDRESS = "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105"; 
const AtomicSwap_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
const pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;
// Global scope
let AtomicSwap;
let recipientWallet;
let balance;
let WETH;

async function main() {

    // Set up provider and signers
    const provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
    const factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";
    const deployerPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";
    const recipientPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";

    if (!deployerPrivateKey || !recipientPrivateKey) {
        throw new Error("Please set DEPLOYER_PRIVATE_KEY and FACTORY_ADMIN_PRIVATE_KEY in your .env file");
    }

    const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    recipientWallet = new ethers.Wallet(recipientPrivateKey, provider);
    const factoryAdminWallet = new ethers.Wallet(factoryAdminPrivateKey, provider);

    console.log("Deployer address:", deployerWallet.address);
    console.log("Recipient wallet address:", recipientWallet.address);
    console.log("Factory Admin address:", factoryAdminWallet.address);

    

    // Load contract ABIs 
    const DAI_ABI = require('../artifacts/contracts/DAI.sol/Dai.json').abi;
    const WETH_ABI = require('../artifacts/contracts/weth.sol/WETH9.json').abi;
    const UniV2Factory_ABI = require('../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json').abi;
    const AtomicSwap_ABI = require('../artifacts/contracts/atomicSwap.sol/AtomicSwap.json').abi;

    // Create contract instances connected to appropriate signers
    const DAI = new ethers.Contract(DAI_ADDRESS, DAI_ABI, deployerWallet);
    WETH = new ethers.Contract(WETH_ADDRESS, WETH_ABI, deployerWallet);
    const UniV2FactoryA = new ethers.Contract(UniV2FactoryA_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
    AtomicSwap = new ethers.Contract(AtomicSwap_ADDRESS, AtomicSwap_ABI, deployerWallet);
    //Get the pair contract from factoryA
    const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);

    // while (true) {

        balance = 100000000000n;
        console.log(`${blue}INFO:${reset} Recipient has ${balance} to work with`)
        // Balance of contract
        console.log(`AtomicSwap contract has ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`)
        let recipient = recipientWallet.address;


        // good info
        console.log(`Total supply of WETH in the system is ${await WETH.totalSupply()}, and DAI is ${await DAI.totalSupply()}`);
        const maxApprovalAmount = ethers.MaxUint256;
        console.log(`Balance of pairA before swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH` );
        console.log(`Balance of recipient before swap: ${await DAI.balanceOf(recipient)} DAI, and ${await WETH.balanceOf(recipient)} WETH` );

        WETHbefore = await WETH.balanceOf(recipient);
        DAIbefore = await DAI.balanceOf(recipient);


        let swapPath;
        swapPath = [WETH_ADDRESS, DAI_ADDRESS];
        swapPath = [DAI_ADDRESS, WETH_ADDRESS];
        fromThis = true;    
        currentNonce = await provider.getTransactionCount(recipientWallet.address, "pending");

        //Get the pair contract from factoryA
        console.log("Reserves A");
        pair = await pairContractA.getReserves();
        console.log(pair[0], pair[1]);
        exchangeRateA = ((pair[0]/pair[1])*(997n))/1000n;

        // May get rid of the percentage later to make it more accurate
        console.log("Exchange rate:", exchangeRateA);

        console.log(`${blue}INFO:${reset} Sending swap transaction with ${swapPath}, ${balance}`)
        let swap = executeSwap (
            swapPath,
            balance,
            UniV2FactoryA_ADDRESS,
            recipient,
            fromThis,
            currentNonce 
        )

        await Promise.all([swap]);

        console.log(`Balance of recipient after swap: ${await DAI.balanceOf(recipient)} DAI, and ${await WETH.balanceOf(recipient)} WETH`);
        console.log(`Balance of contract after swap: ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`);
        console.log(`Balance of pairA after swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH`);

        await wait(13000);  
    // }

}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a swap transaction.
 *
 * @param {string[]} swapPath - The path of tokens to swap.
 * @param {BigNumber} amountIn - The amount of input token.
 * @param {string} factoryAddress - The address of the Uniswap factory.
 * @param {string} recipient - The address receiving the output tokens.
 * @param {boolean} fromThis - Flag indicating the source of tokens.
 * @param {BigNumber} gasPrice - The gas price for the transaction.
 * @returns {Promise<ethers.TransactionReceipt>} - The transaction receipt.
 */
async function executeSwap(swapPath, amountIn, factoryAddress, recipient, fromThis, gasPrice, nonce) {
    try {
        const swapTx = await AtomicSwap.connect(recipientWallet).swap(
            swapPath,
            amountIn,
            factoryAddress,
            recipient,
            fromThis,
            {
                gasPrice: 34141,
                nonce: nonce
            }
        );
        console.log(`Swap transaction sent. Hash: ${swapTx.hash}`);
        const swapReceipt = await swapTx.wait();
        console.log(`Swap transaction confirmed in block ${swapReceipt.blockNumber}`);
        console.log(`${blue}INFO:${reset} Swapped ${balance} DAI for ${await WETH.balanceOf(recipient) - WETHbefore} WETH`)

        return swapReceipt;
    } catch (error) {
        console.error(`Error executing swap with path ${swapPath}:`, error);
        throw error; // Rethrow to let the caller handle it
    }
}



main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Script execution failed:", error);
        process.exit(1);
    });


