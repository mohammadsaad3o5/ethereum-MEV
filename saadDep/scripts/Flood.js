const {ethers} = require('hardhat');
const { type } = require('os');
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


// Global scope
let AtomicSwap;
let recipientWallet;
let WETH;
let noSlippage;


async function main() {
    // Setup the providers and signers
    await setup();
    pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);
    // Store total (DAI is always going to be more - if it's not then there's bigger issues to worry about)
    let total = [0n, 0n];

    // Transaction parameters 
    lines = await readEtherscan("/home/ubuntu/ethereum-MEV/etherscan.csv");
    // Read the file and combine pairs
    pairTransactions = [];
    for (let i = 1; i < lines.length; i += 2) {
        const line1 = lines[i];
        const line2 = lines[i + 1];  // || ''; // Use an empty string if there's no pair for the last line
        pairTransactions.push([line1, line2]); // Push an array of two lines
    }

    // Use the pairs to create a list of transactions to be sent
    listTransactions = [];
    for (const line of pairTransactions) {
        // Split lines and strip quotes
        inputLine = line[0].split(",").map(item => item.replace(/"/g, ''));
        outputLine = line[1].split(",").map(item => item.replace(/"/g, ''));
        if (inputLine[10] == "WETH") { //First transaction sends WETH to contract, hence WETH->DAI
            swapPath = [WETH_ADDRESS, DAI_ADDRESS];
        } else {
            swapPath = [DAI_ADDRESS, WETH_ADDRESS];
        }
        amount = inputLine[6];
        blockNumber = inputLine[1];
        // listTransactions will hold a list of the transaction parameters 
        listTransactions.push([swapPath, amount, blockNumber]);
    }

    // Combine any transactions that happen in a single block as it's meant to be
    const blockTransactionsMap = {};
    for (const transaction of listTransactions) {
        const [swapPath, amount, blockNumber] = transaction;
        // Initialize the array for this block number if it doesn't exist
        if (!blockTransactionsMap[blockNumber]) {
            blockTransactionsMap[blockNumber] = [];
        }

        // Add the transaction to the appropriate block
        blockTransactionsMap[blockNumber].push(transaction);
    }
    // Convert the map to a list of transactions by block
    const blockTransactions = Object.values(blockTransactionsMap);
    console.log(blockTransactions);

    // Start the calculations
    recipient = "0xD8F3183DEF51A987222D845be228e0Bbb932C222";
    balanceDAIstart = await DAI.balanceOf(recipient);
    balanceWETHstart = await WETH.balanceOf(recipient);

    // Call these here because state won't update fast enough to use these inside the loop
    pair = await pairContractA.getReserves();
    console.log(pair);
    token0 = await pairContractA.token0();
    token1 = await pairContractA.token1();
    pair0 = BigInt(pair[0]);
    pair1 = BigInt(pair[1]);

    initialPair = await pairContractA.getReserves();
    // Nonce for the current block
    nonce = await provider.getTransactionCount(recipientWallet.address, "pending")
    count = 0;
    let recieptList;
    expectedDAI = 0n;
    expectedWETH = 0n;
    perfectExpectedWETH = 0n;
    perfectExpectedDAI = 0n;

    for (let i = 0; i < blockTransactions.length; i++) {
        // Store promises
        recieptList = []

        // Loop through blocks
        for (tx of blockTransactions[i]) {
            swapPath = tx[0];
            amt = tx[1].toString();
            amtInWei = BigInt(ethers.parseUnits(amt, 18));
            calculateExpected(swapPath, amtInWei);
            // Update nonce to handle blocked transactions instead of single block
            const fromThis = false; // Using sender's balance       
            // Execute the swap
            let swapTx = await AtomicSwap.swap(
                swapPath,
                amtInWei,
                0n,
                UniV2FactoryA,
                recipient,
                fromThis, {
                    nonce: nonce + count++
                }
            );
            console.log(`Swap transaction sent with amount ${amtInWei}, nonce ${nonce + count}, hash: ${swapTx.hash}}`);//, delta slippage = ${noSlippage-outputAmount}, allowed = ${noSlippage - noSlippage*(9999n/10000n)}`);

            // Will wait for the reciepts later after execution
            recieptList.push(swapTx)
            // Keep track of total. Since I am only using it at the end don't care about the sizes of the reserves
            if (swapPath[0] == DAI_ADDRESS) {
                // total[0] is DAI
                total[0] += amtInWei;
            } else {
                // total[1] is WETH
                total[1] += amtInWei;
            }
        }
        
        // Wait for next block to avoid state issues
        if (count % 50 == 0) {
            // 50 transactions per block
            await waitForNextBlock();
            await waitForNextBlock();
            await waitForNextBlock();
        }   
    }
    // Wait for confirmations for calculation purposes
    
    for (let i = 0; i < recieptList.length; i++) {  
        deltaDAI = await DAI.balanceOf(recipient) - balanceDAIstart;
        deltaWETH = await WETH.balanceOf(recipient) - balanceWETHstart;
        let swapReceipt = await recieptList[i].wait();
        console.log(`Swap ${swapReceipt.hash} completed in block ${await swapReceipt.blockNumber}`);
        // How much was spent and exchanged
        console.log(`Amount exchanged (from the user) ${red} DAI:${total[0]}, WETH:${total[1]} ${reset}`)
        console.log(`After ${count} transactions, change in balance is DAI:${deltaDAI}, WETH:${deltaWETH}\nExpected change was ${expectedDAI} DAI, ${expectedWETH} WETH; if reserves hadn't changed (even with the user transactions), the change would be ${red} ${perfectExpectedDAI} DAI and ${perfectExpectedWETH} WETH ${reset}`)      
        lossDAI = expectedDAI - deltaDAI;  
        lossWETH = expectedWETH - deltaWETH;
        console.log(`Amount loss due to sandwich attack: ${yellow} ${lossDAI} DAI, ${lossWETH} ${reset}`)  
    }
}

function setup() {

    // Contract ABIs and addresses
    DAI_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
    WETH_ADDRESS = "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105";
    UniV2FactoryA_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"; 
    UniV2FactoryB_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
    AtomicSwap_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C"; 
    pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;

    // Set up provider and signers
    provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
    factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";
    deployerPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";
    recipientPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";

    if (!deployerPrivateKey || !recipientPrivateKey) {
        throw new Error("Please set DEPLOYER_PRIVATE_KEY and FACTORY_ADMIN_PRIVATE_KEY in your .env file");
    }

    deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    recipientWallet = new ethers.Wallet(recipientPrivateKey, provider);
    factoryAdminWallet = new ethers.Wallet(factoryAdminPrivateKey, provider);

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

function calculateExactOutputAmount(reserveIn, reserveOut, amountIn) {
    /**
     * Calculate exact output amount using Uniswap V2's actual formula
     * amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
     */
    // Ensure all inputs are BigInt
    reserveIn = BigInt(reserveIn);
    reserveOut = BigInt(reserveOut);
    amountIn = BigInt(amountIn);
    
    const numerator = amountIn * 997n * reserveOut;
    const denominator = (reserveIn * 1000n) + (amountIn * 997n);
    const amountOut = numerator / denominator;

    return amountOut;
}

async function waitForNextBlock() {
    // Wait for the next block
    let prevBlockNumber = await provider.getBlockNumber();
    let blockChangedAt = Date.now();
    console.log(`Starting block number: ${prevBlockNumber}`);
    let currentBlockNumber = await provider.getBlockNumber();
    while (currentBlockNumber == prevBlockNumber) {
        await wait(300);
        // Once the block number changes we are good to go
        currentBlockNumber =  await provider.getBlockNumber();
    }
    console.log(`Block number changed from ${prevBlockNumber} to ${currentBlockNumber}`);
    prevBlockNumber = currentBlockNumber;
    blockChangedAt = Date.now();
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to read and log the contents of etherscan.csv
async function readEtherscan(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');

        // Split the data into lines
        lines = data.split(/\r?\n/);
        
         // Remove commas within numbers (for large numbers in fields)
        lines = lines.map(line => line.replace(/"(\d+),(\d+\.\d+)"/g, '"$1$2"'));

         return lines;
        // Return the list of lines
        return nonEmptyLines;

    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return []
    }   
}

async function calculateExpected(swapPath, amtInWei) {
    // Calculate expected return
    // Want to take into account transactions made by user so as to not overestimate revenue
    // Transaction being sent from the user, adjust reserves for future use
    if (swapPath[0] == DAI_ADDRESS) {
        // DAI --> WETH
        // Check what token0 is 
        if (token0 == DAI_ADDRESS) {
            // There's more DAI in the pool
            outputAmount = calculateExactOutputAmount(pair0, pair1, amtInWei);
            noSlippage = calculateExactOutputAmount(initialPair[0], initialPair[1], amtInWei);
            expectedWETH += outputAmount;
            perfectExpectedWETH += noSlippage;
            // Update reserves with the exact amounts swapped
            pair0 += amtInWei;            // Add input DAI to reserve
            pair1 -= outputAmount;   // Subtract output WETH from reserve

        } else {
            // There's more WETH, so DAI is pair1 (token1)
            outputAmount = calculateExactOutputAmount(pair1, pair0, amtInWei);
            noSlippage = calculateExactOutputAmount(initialPair[1], initialPair[0], amtInWei);
            expectedWETH += outputAmount;
            perfectExpectedWETH += noSlippage;
            // Update reserves with the exact amounts swapped
            pair1 += amtInWei;            // Add input DAI to reserve
            pair0 -= outputAmount;   // Subtract output WETH from reserve
        }
    } else {
        // WETH --> DAI
        // Check what token0 is 
        if (token0 == WETH_ADDRESS) {
            // There's more WETH in the pool
            outputAmount = calculateExactOutputAmount(pair0, pair1, amtInWei);
            noSlippage = calculateExactOutputAmount(initialPair[0], initialPair[1], amtInWei);
            expectedDAI += outputAmount;
            perfectExpectedDAI += noSlippage;
            // Update reserves with the exact amounts swapped
            pair0 += amtInWei;            // Add input WETH to reserve
            pair1 -= outputAmount;   // Subtract output DAI from reserve
        } else {
            // There's more DAI, so WETH is token1
            outputAmount = calculateExactOutputAmount(pair1, pair0, amtInWei);
            noSlippage = calculateExactOutputAmount(initialPair[1], initialPair[0], amtInWei);
            expectedDAI += outputAmount;
            perfectExpectedDAI += noSlippage;
            // Update reserves with the exact amounts swapped
            pair1 += amtInWei;            // Add input WETH to reserve
            pair0 -= outputAmount;   // Subtract output DAI from reserve
        }
    }   
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Script execution failed:", error);
        process.exit(1);
    });



