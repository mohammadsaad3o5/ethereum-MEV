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

function setup() {

    // Contract ABIs and addresses
    DAI_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"; 
    WETH_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C";
    UniV2FactoryA_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
    UniV2FactoryB_ADDRESS = "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105"; 
    AtomicSwap_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
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

function calculateExactOutputAmount(reserveIn, reserveOut, amountIn) {
    /**
     * Calculate exact output amount using Uniswap V2's actual formula
     * amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
     */
    reserveIn = BigInt(reserveIn);
    reserveOut = BigInt(reserveOut);
    amountIn = BigInt(amountIn);
    
    const numerator = amountIn * 997n * reserveOut;
    const denominator = (reserveIn * 1000n) + (amountIn * 997n);
    const amountOut = numerator / denominator;
    
    // // Let's also show all intermediate values for verification
    // console.log({
    //     numerator: numerator.toString(),
    //     denominator: denominator.toString(),
    //     amountOut: amountOut.toString()
    // });
    
    return amountOut;
}

// function calculateOutputAmount(reserveIn, reserveOut, amountIn) {
//     /**
//      * Calculate how many reserveOut tokens will be provided when swapping amountIn of reserveIn tokens in a constant product AMM.
//      *
//      * :param reserveIn: Initial reserve of the input token (BigInt)
//      * :param reserveOut: Initial reserve of the output token (BigInt)
//      * :param amountIn: Amount of input token to trade (BigInt)
//      * :return: Amount of output token to be provided (BigInt)
//      */
    
//     reserveIn = BigInt(reserveIn);
//     reserveOut = BigInt(reserveOut);
//     amountIn = BigInt(amountIn);
    
//     // Update the input reserve with the incoming amount
//     const newReserveIn = reserveIn + amountIn;
    
//     // Calculate the new output reserve using the constant product formula
//     const newReserveOut = (reserveIn * reserveOut) / newReserveIn;
    
//     // The output amount is the difference between the old and new output reserves
//     const amountOut = reserveOut - newReserveOut;
    
//     return amountOut;
// }


// Global scope
let AtomicSwap;
let recipientWallet;
let WETH;

async function main() {
    // Setup the providers and signers
    await setup();
    pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);

    const numTransactions = 5n;
    let total = [0n, 0n];

    // Transaction parameters 


    // Start the calculations
    recipient = "0xD8F3183DEF51A987222D845be228e0Bbb932C222";
    balanceDAIstart = await DAI.balanceOf(recipient);
    balanceWETHstart = await WETH.balanceOf(recipient);
    let recieptList = []
    let expected = 0n;

    // Make sure the transactions are sent at the very start of the block
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
    

    console.log("If you see this, transactions should start getting printed");


    // Call these here because state won't update fast enough to use these inside the loop
    nonce = await provider.getTransactionCount(recipientWallet.address, "pending")
    pair = await pairContractA.getReserves();
    console.log(pair);
    token0 = await pairContractA.token0();
    token1 = await pairContractA.token1();
    pair0 = pair[0];
    pair1 = pair[1];

    for (let i = 0; i < numTransactions; i++) {

        amt = 90000n;
        // For me to distinguish the transactions
        amt = amt + BigInt(getRandomInt(1,100));

        // Token swapping order
        swapPath = [DAI_ADDRESS, WETH_ADDRESS];
        // swapPath = [WETH_ADDRESS, DAI_ADDRESS];

        // Calculate expected return
        // Want to take into account transactions made by user so as to not overestimate revenue
        // Transaction being sent from the user, adjust reserves for future use
        if (swapPath[0] == DAI_ADDRESS) {
            // DAI --> WETH
            // Check what token0 is 
            if (token0 == DAI_ADDRESS) {
                // There's more DAI in the pool
                const outputAmount = calculateExactOutputAmount(pair0, pair1, amt);
                expected += outputAmount;
                // Update reserves with the exact amounts swapped
                pair0 += amt;            // Add input DAI to reserve
                pair1 -= outputAmount;   // Subtract output WETH from reserve
            } else {
                // There's more WETH, so DAI is pair1 (token1)
                const outputAmount = calculateExactOutputAmount(pair1, pair0, amt);
                expected += outputAmount;
                // Update reserves with the exact amounts swapped
                pair1 += amt;            // Add input DAI to reserve
                pair0 -= outputAmount;   // Subtract output WETH from reserve
            }
        } else {
            // WETH --> DAI
            // Check what token0 is 
            if (token0 == WETH_ADDRESS) {
                // There's more WETH in the pool
                const outputAmount = calculateExactOutputAmount(pair0, pair1, amt);
                expected += outputAmount;
                // Update reserves with the exact amounts swapped
                pair0 += amt;            // Add input WETH to reserve
                pair1 -= outputAmount;   // Subtract output DAI from reserve
            } else {
                // There's more DAI, so WETH is token1
                const outputAmount = calculateExactOutputAmount(pair1, pair0, amt);
                expected += outputAmount;
                // Update reserves with the exact amounts swapped
                pair1 += amt;            // Add input WETH to reserve
                pair0 -= outputAmount;   // Subtract output DAI from reserve
            }
        }
        
        const fromThis = false; // Using sender's balance       
        // Execute the swap
        let swapTx = await AtomicSwap.swap(
            swapPath,
            amt,
            UniV2FactoryA,
            recipient,
            fromThis, {
                nonce: nonce + i
            }
        );
        console.log(`Swap transaction sent with amount ${amt}, nonce ${nonce + i}, hash: ${swapTx.hash}`);
        // Will wait for the reciepts later after execution
        recieptList.push(swapTx)
        // Keep track of total. Since I am only using it at the end don't care about the sizes of the reserves
        if (swapPath[0] == DAI_ADDRESS) {
            // total[0] is DAI
            total[0] += amt;
        } else {
            // total[1] is WETH
            total[1] += amt;
        }
    }

    // Wait for confirmations for calculation purposes
    for (let i = 0; i < recieptList.length; i++) {
        let swapReceipt = await recieptList[i].wait();
        console.log(`Swap ${swapReceipt.hash} completed in block ${await swapReceipt.blockNumber}`);
    }

    // Accounted for the fees during calculation, make sure to account for small errors
    // if (numTransactions > 1n) {
    //     expected = expected - Number(numTransactions);
    // }
    deltaDAI = await DAI.balanceOf(recipient) - balanceDAIstart;
    deltaWETH = await WETH.balanceOf(recipient) - balanceWETHstart;
    // How much was spent and exchanged
    console.log(`Amount exchanged (from the user) DAI:${total[0]}, WETH:${total[1]}`)
    console.log(`After ${numTransactions} transactions, change in balance is DAI:${deltaDAI}, WETH:${deltaWETH}\nExpected change was ${expected}`)

}


function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Script execution failed:", error);
        process.exit(1);
    });



