const { ethers } = require('hardhat');
const { type } = require('os');
const path = require("path");
const hardhatConfig = require(path.resolve(__dirname, "../hardhat.config.js"));
const fs = require('fs').promises;
const fsS = require('fs');

// Reset
const reset = "\x1b[0m";

// Regular Colors
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";

// Global scope
let AtomicSwap;
let recipientWalletDAI;
let recipientWalletWETH;
let WETH;
let noSlippage;

// Set up the data file path and write stream
const dataFilePath = path.join(__dirname, 'simulation_results.txt');
const dataStream = fsS.createWriteStream(dataFilePath, { flags: 'w' }); // 'w' flag to overwrite existing file

async function main() {

    // Setup the providers and signers
    await setup();
    // Write headers to the data file
    dataStream.write('DAIAmount,WETHAmount,BlockNumber,AttackerProfitDAI,AttackerProfitWETH,Token0Reserve,Token1Reserve\n');

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
        if (inputLine[10] == "WETH") { // First transaction sends WETH to contract, hence WETH->DAI
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

    // await waitForNextBlock();

    // Start the calculations
    recipientDAI = recipientWalletDAI.address;
    recipientWETH = recipientWalletWETH.address;
    await approveToken(DAI, AtomicSwap_ADDRESS, ethers.MaxUint256, recipientWalletDAI);
    await approveToken(WETH, AtomicSwap_ADDRESS, ethers.MaxUint256, recipientWalletDAI);

    // Nonce for the current block
    nonce = await provider.getTransactionCount(deployerWallet.address, "pending");
    nonceDAI = await provider.getTransactionCount(recipientWalletDAI.address, "pending");
    nonceWETH = await provider.getTransactionCount(recipientWalletWETH.address, "pending");
    countDAI = 0;
    countWETH = 0;
    count = 0;
    gasPrice = 1000007n;

    // Initialize total expected amounts
    let totalExpectedDAI = 0n;
    let totalExpectedWETH = 0n;
    let totalPerfectExpectedDAI = 0n;
    let totalPerfectExpectedWETH = 0n;

    for (let i = 0; i < blockTransactions.length; i++) {
        // Reset variables for the block
        expectedDAI = 0n;
        expectedWETH = 0n;
        perfectExpectedDAI = 0n;
        perfectExpectedWETH = 0n;

        const baseFee = (await provider.getBlock('latest')).baseFeePerGas;
        console.log(baseFee);

        // Get current reserves and update pair variables
        pair = await pairContractA.getReserves();
        token0 = await pairContractA.token0();
        token1 = await pairContractA.token1();
        pair0 = BigInt(pair[0]);
        pair1 = BigInt(pair[1]);
        initialPair = [pair0, pair1];

        // Get initial balances of recipients
        recipientDAIinitalDAI = await DAI.balanceOf(recipientDAI);
        recipientDAIinitalWETH = await WETH.balanceOf(recipientDAI);
        recipientWETHinitalDAI = await DAI.balanceOf(recipientWETH);
        recipientWETHinitalWETH = await WETH.balanceOf(recipientWETH);

        // Store promises
        recieptList = [];
        // Loop through transactions in the block
        for (tx of blockTransactions[i]) {
            swapPath = tx[0];
            amt = tx[1].toString();
            amtInWei = BigInt(ethers.parseUnits(amt, 18));
            calculateExpected(swapPath, amtInWei);

            // Update nonce to handle blocked transactions instead of single block

            // When DAI --> WETH, recipient account does not get charged DAI (gets free WETH)

            // Keep track of total. Since we are only using it at the end don't care about the sizes of the reserves
            if (swapPath[0] == DAI_ADDRESS) {   // DAI --> WETH
                Spath = "DAI-->WETH";
                // total[0] is DAI
                total[0] += amtInWei;
                recipient = recipientWETH;
                fromThis = false; // Using sender's balance
                nonce = nonceWETH++; // + countWETH++
                router = AtomicSwapWETH;
                countWETH++;
            } else {                            // WETH --> DAI
                // total[1] is WETH
                Spath = "WETH-->DAI";
                total[1] += amtInWei;
                recipient = recipientDAI;
                nonce = nonceDAI++; // + countDAI++
                fromThis = false; // Using sender's balance
                router = AtomicSwapDAI;
                countDAI++;
            }

            // Execute the swap inside a try/catch block
            try {
                let swapTx = await router.swap(
                    swapPath,
                    amtInWei,
                    0n,
                    UniV2FactoryA,
                    recipient,
                    fromThis,
                    {
                        nonce: nonce, // nonce + count++,
                        gasPrice: gasPrice
                    }
                );
                console.log(`${Spath} swap transaction sent with amount ${amtInWei}, gasPrice ${gasPrice}, nonce ${nonce + count}, hash: ${swapTx.hash}`);
                // Differentiate the transactions using gasPrice
                gasPrice -= 5n;
                // Will wait for the receipts later after execution
                recieptList.push(swapTx);
            } catch (error) {
                console.error(`Error sending swap transaction:`, error);

                // Log the error to the data file
                const currentBlockNumber = await provider.getBlockNumber();
                const dataLine = `${0},${0},${currentBlockNumber},0,0,${pair0.toString()},${pair1.toString()},Error,"Error in swap transaction: ${error.message}"\n`;
                dataStream.write(dataLine);
                // Continue to next transaction
                continue;
            }
        }
        

        // Wait for the block transactions
        
        // Wait for transaction receipts
        for (let j = 0; j < recieptList.length; j++) {
            try {
                let swapReceipt = await recieptList[j].wait();
                console.log(`Swap ${swapReceipt.hash} completed in block ${await swapReceipt.blockNumber}`);
            } catch (error) {
                console.error(`Error waiting for transaction receipt:`, error);

                // Log the error to the data file
                const currentBlockNumber = await provider.getBlockNumber();
                const dataLine = `${0},${0},${currentBlockNumber},0,0,${pair0.toString()},${pair1.toString()},Error,"Error in transaction receipt: ${error.message}"\n`;
                dataStream.write(dataLine);
                // Continue to next receipt
                continue;
            }
        }
        await waitForNextBlock();
        await waitForNextBlock();
        await waitForNextBlock();


        // Calculate amounts exchanged and expected
        // Recalculate the recipient balances
        DAIExchanged = await DAI.balanceOf(recipientWETH) - recipientWETHinitalDAI;
        if (DAIExchanged < 0n) DAIExchanged = DAIExchanged * -1n;

        WETHExchanged = await WETH.balanceOf(recipientDAI) - recipientDAIinitalWETH;
        if (WETHExchanged < 0n) WETHExchanged = WETHExchanged * -1n;

        WETHExtracted = await WETH.balanceOf(recipientWETH) - recipientWETHinitalWETH;
        if (WETHExtracted < 0n) WETHExtracted = WETHExtracted * -1n;

        DAIExtracted = await DAI.balanceOf(recipientDAI) - recipientDAIinitalDAI;
        if (DAIExtracted < 0n) DAIExtracted = DAIExtracted * -1n;

        // Update total expected amounts
        totalExpectedDAI += expectedDAI;
        totalExpectedWETH += expectedWETH;
        totalPerfectExpectedDAI += perfectExpectedDAI;
        totalPerfectExpectedWETH += perfectExpectedWETH;

        console.log(`\n${yellow}Results after processing block ${i + 1}:${reset}`);
        console.log(`${green}Amount exchanged (from the user): DAI: ${total[0]}, WETH: ${total[1]}${reset}`);
        console.log(`DAI exchanged in this block: ${DAIExchanged}, WETH exchanged in this block: ${WETHExchanged}`);
        console.log(`Expected change in this block: ${red}${expectedDAI} DAI, ${expectedWETH} WETH${reset}`);
        console.log(`If reserves hadn't changed (perfect scenario): ${yellow}${perfectExpectedDAI} DAI, ${perfectExpectedWETH} WETH${reset}`);
        console.log(`Amount gotten from swaps in this block: ${DAIExtracted} DAI, ${WETHExtracted} WETH`);

        let lossCalcDAI;
        let lossCalcWETH;
        if (BigInt(perfectExpectedDAI) > BigInt(expectedDAI)) {
            lossCalcDAI = BigInt(perfectExpectedDAI);
        } else {
            lossCalcDAI = BigInt(expectedDAI);
        }
        if (BigInt(perfectExpectedWETH) > BigInt(expectedWETH)) {
            lossCalcWETH = BigInt(perfectExpectedWETH);
        } else {
            lossCalcWETH = BigInt(expectedWETH);
        }

        lossDAI = BigInt(lossCalcDAI) - BigInt(DAIExtracted);
        lossWETH = BigInt(lossCalcWETH) - BigInt(WETHExtracted);
        console.log(`Amount loss due to sandwich attack in this block: ${blue}${lossDAI} DAI, ${lossWETH} WETH${reset}\n`);

        // Attacker profit is lossDAI and/or lossWETH
        // Now, get the current block number
        const currentBlockNumber = await provider.getBlockNumber();

        // Get the reserves after the block
        const reservesAfter = await pairContractA.getReserves();
        const reserve0 = BigInt(reservesAfter[0]);
        const reserve1 = BigInt(reservesAfter[1]);
        // Collect the data
        const dataLine = `${DAIExchanged.toString()},${WETHExchanged.toString()},${currentBlockNumber},${lossDAI.toString()},${lossWETH.toString()},${reserve0.toString()},${reserve1.toString()}\n`;
        dataStream.write(dataLine);

    }

    // Optionally, after all blocks are processed, print total results
    console.log(`${yellow}Total results after processing all blocks:${reset}`);
    console.log(`${green}Total amount exchanged (from the user): DAI: ${total[0]}, WETH: ${total[1]}${reset}`);
    console.log(`Total expected change: ${red}${totalExpectedDAI} DAI, ${totalExpectedWETH} WETH${reset}`);
    console.log(`Total perfect expected change: ${yellow}${totalPerfectExpectedDAI} DAI, ${totalPerfectExpectedWETH} WETH${reset}`);
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
    recipientPrivateKeyDAI = "0x3fd98b5187bf6526734efaa644ffbb4e3670d66f5d0268ce0323ec09124bff61";
    recipientPrivateKeyWETH = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";

    deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    recipientWalletDAI = new ethers.Wallet(recipientPrivateKeyDAI, provider);
    recipientWalletWETH = new ethers.Wallet(recipientPrivateKeyWETH, provider);
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
    AtomicSwapWETH = new ethers.Contract(AtomicSwap_ADDRESS, AtomicSwap_ABI, recipientWalletWETH);
    AtomicSwapDAI = new ethers.Contract(AtomicSwap_ADDRESS, AtomicSwap_ABI, recipientWalletDAI);
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
    // console.log(`Starting block number: ${prevBlockNumber}`);
    let currentBlockNumber = await provider.getBlockNumber();
    while (currentBlockNumber == prevBlockNumber) {
        await wait(300);
        // Once the block number changes we are good to go
        currentBlockNumber = await provider.getBlockNumber();
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
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
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

// Approve token order through router
async function approveToken(tokenContract, spenderAddress, amount, signer) {
    try {
        // Connect the contract to the signer
        const tokenWithSigner = tokenContract.connect(signer);

        // Check allowance using the connected contract
        const allowance = await tokenWithSigner.allowance(signer.address, spenderAddress);
        if (allowance >= amount) {
            // console.log(`Token already approved for spender ${spenderAddress}, skipping approval.`);
            return;
        }

        // Call approve using the connected contract
        const tx = await tokenWithSigner.approve(spenderAddress, amount);
        console.log(`Transaction submitted: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`"some token" approved with transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
        console.error(`Error approving "some" token:`, error);
    }
}

main()
    .then(() => {
        dataStream.end(); // Close the write stream
        process.exit(0);
    })
    .catch(error => {
        console.error("Script execution failed:", error);
        dataStream.end(); // Ensure the stream is closed even if there's an error
        process.exit(1);
    });
