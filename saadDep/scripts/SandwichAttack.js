const { ethers, getNamedAccounts, network } = require('hardhat');
const { setUnion } = require('mathjs');
const path = require("path");
const hardhatConfig = require(path.resolve(__dirname, "../hardhat.config.js"));
const fs = require('fs').promises;


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

async function main() {

    setup();    

    let balance = 3000n;
    console.log(`INFO: Recipient has ${balance} to work with`)
    // Balance of contract
    console.log(`AtomicSwap contract has ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`)

    //Get the pair contract from factoryA
    const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);

    // Not the same as the flooder
    let recipient = recipientWallet.address;
    // Good info
    // console.log(`Total supply of WETH in the system is ${await WETH.totalSupply()}, and DAI is ${await DAI.totalSupply()}`);
    // console.log(`Balance of pairA before swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH` );
        
    while (true) {
        // Make sure its the same 
        // Read and log the arbitrage.txt file
        lines = await readArbitrageFile("/home/ubuntu/ethereum-MEV/arbitrage.txt");


        for (const line of lines) {  
            balance = 3000n;
            balance = balance + BigInt(getRandomInt(1,100));
            // get the deets
            lineArr = line.split(",");
            tokenA = lineArr[0];
            tokenB = lineArr[1];
            amount = Number(lineArr[2]);
            gasPrice = Number(lineArr[3]);
            
            
            balanceDAIstart = await DAI.balanceOf(recipient);
            balanceWETHstart = await WETH.balanceOf(recipient);

            let swapPath;
            let reverse;
            // Swap DAI to WETH at the exchange rate from pair A
            if (tokenA === "DAI") {
                swapPath = [DAI_ADDRESS, WETH_ADDRESS];
                reverse = [WETH_ADDRESS, DAI_ADDRESS];
            } else {
                swapPath = [WETH_ADDRESS, DAI_ADDRESS];
                reverse = [DAI_ADDRESS, WETH_ADDRESS];
            }
            fromThis = false;    
            currentNonce = await provider.getTransactionCount(deployerWallet.address, "pending");

            //Get the pair contract from factoryA
            console.log("Reserves A", currentNonce);
            pair = await pairContractA.getReserves();
            console.log(pair[0], pair[1]);


            console.log(`INFO: Sending swap transaction with ${swapPath}, ${balance}, gasPrice ${gasPrice + 1}`)
            let swap1 = await AtomicSwap.swap(
                swapPath,
                balance,
                UniV2FactoryA_ADDRESS,
                recipient,
                fromThis,
                { 
                    gasPrice: gasPrice + 1,
                    nonce: currentNonce + 1
                } 
            )
            console.log(`Swap transaction sent. ${swap1.hash}`);
            

            // if the inital transaction was WETH to DAI then use the balance from DAI difference
            if (tokenA === "DAI") {
                // balance = await DAI.balanceOf(recipient) - DAIbefore;
                // DAI was user transaction
                // WETH -> DAI made first, hence change back DAI -> WETH
                balance = calculateOutputAmount(pair[0], pair[1], amount);
            } else {
                // balance = await WETH.balanceOf(recipient) - WETHbefore;
                balance = balance/exchangeRateA;
            }

            console.log(`INFO: Sending swap transaction with ${reverse}, ${balance}, gasPrice ${gasPrice - 1}`)
            let swap2 = await AtomicSwap.swap(
                reverse,
                balance,
                UniV2FactoryA_ADDRESS,
                recipient,
                fromThis, {
                    gasPrice: gasPrice - 1,
                    nonce: currentNonce
                }
            )
            console.log(`Swap transaction sent. ${swap2.hash}`);

            await Promise.all([swap1, swap2]);
            console.log(swap1.blockNumber, swap2.blockNumber);


    }

        await wait(500);  
    }

}

function setup() {
    // Set up provider and signers
    provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
    factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";
    deployerPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";
    recipientPrivateKey = "0x6ecadc396415970e91293726c3f5775225440ea0844ae5616135fd10d66b5954";

    if (!deployerPrivateKey || !recipientPrivateKey) {
        throw new Error("Please set DEPLOYER_PRIVATE_KEY and FACTORY_ADMIN_PRIVATE_KEY in your .env file");
    }

    deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    recipientWallet = new ethers.Wallet(recipientPrivateKey, provider);
    factoryAdminWallet = new ethers.Wallet(factoryAdminPrivateKey, provider);

    console.log("Deployer address:", deployerWallet.address);
    console.log("Recipient wallet address:", recipientWallet.address);
    console.log("Factory Admin address:", factoryAdminWallet.address);

    // Load contract ABIs 
    DAI_ABI = require('../artifacts/contracts/DAI.sol/Dai.json').abi;
    WETH_ABI = require('../artifacts/contracts/weth.sol/WETH9.json').abi;
    UniV2Factory_ABI = require('../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json').abi;
    AtomicSwap_ABI = require('../artifacts/contracts/atomicSwap.sol/AtomicSwap.json').abi;

    // Create contract instances connected to appropriate signers
    DAI = new ethers.Contract(DAI_ADDRESS, DAI_ABI, deployerWallet);
    WETH = new ethers.Contract(WETH_ADDRESS, WETH_ABI, deployerWallet);
    UniV2FactoryA = new ethers.Contract(UniV2FactoryA_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
    UniV2FactoryB = new ethers.Contract(UniV2FactoryB_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
    AtomicSwap = new ethers.Contract(AtomicSwap_ADDRESS, AtomicSwap_ABI, deployerWallet);
    
}

function calculateOutputAmount(reserveA, reserveB, amountA_in) {
    /**
     * Calculate how many reserveB tokens will be provided when swapping reserveA tokens in a constant product AMM.
     *
     * :param reserveA: Initial reserve of token A (BigInt)
     * :param reserveB: Initial reserve of token B (BigInt)
     * :param amountA_in: Amount of token A to trade (BigInt)
     * :return: Amount of token B to be provided (BigInt)
     */

    // Ensure inputs are BigInt
    reserveA = BigInt(reserveA);
    reserveB = BigInt(reserveB);
    amountA_in = BigInt(amountA_in);

    // Constant product formula: (reserveA + amountA_in) * new_reserveB = reserveA * reserveB
    // Rearranged to solve for new_reserveB:
    const new_reserveB = (reserveA * reserveB) / (reserveA + amountA_in);

    // The amount of token B that will be provided is the difference between initial and new reserveB
    const amountB_out = reserveB - new_reserveB;

    return amountB_out;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



// Function to read and log the contents of arbitrage.txt
async function readArbitrageFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');

        // Split the data into lines
        const lines = data.split(/\r?\n/);

        // Optionally, filter out any empty lines (if desired)
        const nonEmptyLines = lines.filter(line => line.trim() !== '');

        // Clear the file
        await fs.truncate(filePath, 0);
        // Return the list of lines
        return nonEmptyLines;

    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);

        return []
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Script execution failed:", error);
        process.exit(1);
    });

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


// const { ethers, getNamedAccounts, network } = require('hardhat');
// const { setUnion } = require('mathjs');
// const path = require("path");
// const hardhatConfig = require(path.resolve(__dirname, "../hardhat.config.js"));
// const fs = require('fs').promises;


// // Contract ABIs and addresses
// const DAI_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"; 
// const WETH_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C";
// const UniV2FactoryA_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
// const UniV2FactoryB_ADDRESS = "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105"; 
// const AtomicSwap_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
// const pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;
// // Global scope
// let AtomicSwap;
// let recipientWallet;

// async function main() {

//     setup();    

//     while (true) {
//         // Read and log the arbitrage.txt file
//         lines = await readArbitrageFile("/home/ubuntu/ethereum-MEV/arbitrage.txt");


//         for (const line of lines) {  
//             // get the deets
//             lineArr = line.split(",");
//             tokenA = lineArr[0];
//             tokenB = lineArr[1];
//             amount = Number(lineArr[2]);
//             gasPrice = Number(lineArr[3]);

//             let balance = 3000n;
//             console.log(`INFO: Recipient has ${balance} to work with`)
//             // Balance of contract
//             console.log(`AtomicSwap contract has ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`)


//             //Get the pair contract from factoryA
//             const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
//             let pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);

//             let recipient = "0xfDCe42116f541fc8f7b0776e2B30832bD5621C85";


//             // good info
//             // console.log(`Total supply of WETH in the system is ${await WETH.totalSupply()}, and DAI is ${await DAI.totalSupply()}`);
//             const maxApprovalAmount = ethers.MaxUint256;
//             // console.log(`Balance of pairA before swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH` );
//             balanceDAIstart = await DAI.balanceOf(recipient);
//             balanceWETHstart = await WETH.balanceOf(recipient);

//             let swapPath;
//             let reverse;
//             // Swap DAI to WETH at the exchange rate from pair A
//             if (tokenA === "DAI") {
//                 swapPath = [DAI_ADDRESS, WETH_ADDRESS];
//                 reverse = [WETH_ADDRESS, DAI_ADDRESS];
//             } else {
//                 swapPath = [WETH_ADDRESS, DAI_ADDRESS];
//                 reverse = [DAI_ADDRESS, WETH_ADDRESS];
//             }
//             fromThis = false;    
//             currentNonce = await provider.getTransactionCount(recipientWallet.address, "pending");

//             //Get the pair contract from factoryA
//             console.log("Reserves A");
//             pair = await pairContractA.getReserves();
//             console.log(pair[0], pair[1]);
//             // exchangeRateA = ((pair[0]/pair[1])*(997n))/1000n;

//             // // May get rid of the percentage later to make it more accurate
//             // console.log("Exchange rate:", exchangeRateA);

//             console.log(`INFO: Sending swap transaction with ${swapPath}, ${balance}, gasPrice ${gasPrice + 1}`)
//             let swap1 = executeSwap (
//                 swapPath,
//                 balance,
//                 UniV2FactoryA_ADDRESS,
//                 recipient,
//                 fromThis,
//                 gasPrice - 1,
//                 currentNonce
//             )
//             // console.log(`Swap transaction sent. Waiting for confirmation... ${swapTx.hash}`);
//             // swapReceipt = await swapTx.wait();
//             // console.log(`Swap completed in block ${swapReceipt.blockNumber}`);
//             // console.log(`Balance of recipient after swap: ${await DAI.balanceOf(recipient)} DAI, and ${await WETH.balanceOf(recipient)} WETH`);
//             // console.log(`Balance of contract after swap: ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`);
//             // console.log(`Balance of pairA after swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH`);

//             // if the inital transaction was WETH to DAI then use the balance from DAI difference
//             if (tokenA === "DAI") {
//                 // balance = await DAI.balanceOf(recipient) - DAIbefore;
//                 // DAI was user transaction
//                 // WETH -> DAI made first, hence change back DAI -> WETH
//                 balance = balance*calculateOutputAmount(pair[0], pair[1], amount);
//             } else {
//                 // balance = await WETH.balanceOf(recipient) - WETHbefore;
//                 balance = balance/exchangeRateA;
//             }

//             console.log(`INFO: Sending swap transaction with ${reverse}, ${balance}`)
//             let swap2 = executeSwap (
//                 reverse,
//                 balance,
//                 UniV2FactoryA_ADDRESS,
//                 recipient,
//                 fromThis,
//                 gasPrice + 1,
//                 currentNonce + 1
//             )
//             // console.log(`Swap transaction sent. Waiting for confirmation... ${swapTx.hash}`);
//             // swapReceipt = await swapTx.wait();
//             // console.log(`Swap completed in block ${swapReceipt.blockNumber}`);
//             // console.log(`Balance of recipient after swap: ${await DAI.balanceOf(recipient)} DAI, and ${await WETH.balanceOf(recipient)} WETH`);
//             // console.log(`Balance of pairA after swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH`);

//             // await Promise.all([swap1, swap2]);



//     }

//         await wait(500);  
//     }

// }

// function setup() {
//     // Set up provider and signers
//     provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
//     factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";
//     deployerPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";
//     recipientPrivateKey = "0x6ecadc396415970e91293726c3f5775225440ea0844ae5616135fd10d66b5954";

//     if (!deployerPrivateKey || !recipientPrivateKey) {
//         throw new Error("Please set DEPLOYER_PRIVATE_KEY and FACTORY_ADMIN_PRIVATE_KEY in your .env file");
//     }

//     deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
//     recipientWallet = new ethers.Wallet(recipientPrivateKey, provider);
//     factoryAdminWallet = new ethers.Wallet(factoryAdminPrivateKey, provider);

//     console.log("Deployer address:", deployerWallet.address);
//     console.log("Recipient wallet address:", recipientWallet.address);
//     console.log("Factory Admin address:", factoryAdminWallet.address);

//     // Load contract ABIs 
//     DAI_ABI = require('../artifacts/contracts/DAI.sol/Dai.json').abi;
//     WETH_ABI = require('../artifacts/contracts/weth.sol/WETH9.json').abi;
//     UniV2Factory_ABI = require('../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json').abi;
//     AtomicSwap_ABI = require('../artifacts/contracts/atomicSwap.sol/AtomicSwap.json').abi;

//     // Create contract instances connected to appropriate signers
//     DAI = new ethers.Contract(DAI_ADDRESS, DAI_ABI, deployerWallet);
//     WETH = new ethers.Contract(WETH_ADDRESS, WETH_ABI, deployerWallet);
//     UniV2FactoryA = new ethers.Contract(UniV2FactoryA_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
//     UniV2FactoryB = new ethers.Contract(UniV2FactoryB_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
//     AtomicSwap = new ethers.Contract(AtomicSwap_ADDRESS, AtomicSwap_ABI, deployerWallet);
    
// }

// function calculateOutputAmount(reserveA, reserveB, amountA_in) {
//     /**
//      * Calculate how many reserveB tokens will be provided when swapping reserveA tokens in a constant product AMM.
//      *
//      * :param reserveA: Initial reserve of token A (BigInt)
//      * :param reserveB: Initial reserve of token B (BigInt)
//      * :param amountA_in: Amount of token A to trade (BigInt)
//      * :return: Amount of token B to be provided (BigInt)
//      */

//     // Ensure inputs are BigInt
//     reserveA = BigInt(reserveA);
//     reserveB = BigInt(reserveB);
//     amountA_in = BigInt(amountA_in);

//     // Constant product formula: (reserveA + amountA_in) * new_reserveB = reserveA * reserveB
//     // Rearranged to solve for new_reserveB:
//     const new_reserveB = (reserveA * reserveB) / (reserveA + amountA_in);

//     // The amount of token B that will be provided is the difference between initial and new reserveB
//     const amountB_out = reserveB - new_reserveB;

//     return amountB_out;
// }

// function wait(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// /**
//  * Executes a swap transaction.
//  *
//  * @param {string[]} swapPath - The path of tokens to swap.
//  * @param {BigNumber} amountIn - The amount of input token.
//  * @param {string} factoryAddress - The address of the Uniswap factory.
//  * @param {string} recipient - The address receiving the output tokens.
//  * @param {boolean} fromThis - Flag indicating the source of tokens.
//  * @param {BigNumber} gasPrice - The gas price for the transaction.
//  * @returns {Promise<ethers.TransactionReceipt>} - The transaction receipt.
//  */
// async function executeSwap(swapPath, amountIn, factoryAddress, recipient, fromThis, gasPrice, nonce) {
//     try {
//         const swapTx = await AtomicSwap.connect(recipientWallet).swap(
//             swapPath,
//             amountIn,
//             factoryAddress,
//             recipient,
//             fromThis,
//             {
//                 gasPrice: gasPrice,
//                 nonce: nonce
//             }
//         );
//         console.log(`Swap transaction sent. Hash: ${swapTx.hash}`);
//         const swapReceipt = await swapTx.wait();
//         console.log(`Swap transaction confirmed in block ${swapReceipt.blockNumber}`);
//         return swapReceipt;
//     } catch (error) {
//         console.error(`Error executing swap with path ${swapPath}:`, error);
//         throw error; // Rethrow to let the caller handle it
//     }
// }


// // Function to read and log the contents of arbitrage.txt
// async function readArbitrageFile(filePath) {
//     try {
//         const data = await fs.readFile(filePath, 'utf8');

//         // Split the data into lines
//         const lines = data.split(/\r?\n/);

//         // Optionally, filter out any empty lines (if desired)
//         const nonEmptyLines = lines.filter(line => line.trim() !== '');

//         // Clear the file
//         await fs.truncate(filePath, 0);
//         // Return the list of lines
//         return nonEmptyLines;

//     } catch (error) {
//         console.error(`Error reading ${filePath}:`, error);

//         return []
//     }
// }


// main()
//     .then(() => process.exit(0))
//     .catch(error => {
//         console.error("Script execution failed:", error);
//         process.exit(1);
//     });


