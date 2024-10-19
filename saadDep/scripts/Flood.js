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

function calculateOutputAmount(reserveA, reserveB, amountA_in) {
    /**
     * Calculate how many reserveB tokens will be provided when swapping reserveA tokens in a constant product AMM.
     *
     * :param reserveA: Initial reserve of token A (BigInt)
     * :param reserveB: Initial reserve of token B (BigInt)
     * :param amountA_in: Amount of token A to trade (BigInt)
     * :return: Amount of token B to be provided (BigInt)
     */

    reserveA = BigInt(reserveA);
    reserveB = BigInt(reserveB);
    amountA_in = BigInt(amountA_in);

    // Constant product formula: (reserveA + amountA_in) * new_reserveB = reserveA * reserveB
    const new_reserveB = (reserveA * reserveB) / (reserveA + amountA_in);

    // The amount of token B that will be provided is the difference between initial and new reserveB
    const amountB_out = reserveB - new_reserveB;

    return amountB_out;
}


// Global scope
let AtomicSwap;
let recipientWallet;
let WETH;

async function main() {
    // Setup the providers and signers
    await setup();
    pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);

    nonce = await provider.getTransactionCount(recipientWallet.address, "pending")
    const numTransactions = 1n;
    let total = [0n, 0n];

    // Transaction parameters 
    amt = 3000n;
    // Start the calculations
    recipient = "0xD8F3183DEF51A987222D845be228e0Bbb932C222";
    balanceDAIstart = await DAI.balanceOf(recipient);
    balanceWETHstart = await WETH.balanceOf(recipient);
    let recieptList = []
    let expected = 0n;

    for (let i = 0; i < numTransactions; i++) {

        // For me to distinguish the transactions
        amt = amt + BigInt(getRandomInt(1,100));

        // Calculate expected return
        pair = await pairContractA.getReserves();
        expected += calculateOutputAmount(pair[0], pair[1], amt)

        console.log(amt, nonce + i);
        let swapPath = [DAI_ADDRESS, WETH_ADDRESS];
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
        console.log(`Swap transaction sent, hash: ${swapTx.hash}`);
        recieptList.push(swapTx)
        if (swapPath[0] == DAI_ADDRESS) {
            total[0] += amt;
        } else {
            total[1] += amt;
        }
    }

    // Wait for confirmations for calculation purposes
    for (let i = 0; i < recieptList.length; i++) {
        let swapReceipt = await recieptList[i].wait();
        console.log(`Swap ${swapReceipt.hash} completed in block ${await swapReceipt.blockNumber}`);
    }

    // Account  for the fees
    expected = Number(expected)*0.997;
    deltaDAI = await DAI.balanceOf(recipient) - balanceDAIstart;
    deltaWETH = await WETH.balanceOf(recipient) - balanceWETHstart;
    // How much was spent and exchanged
    console.log(`Amount exchanged (from the user) DAI:${total[0]}, WETH:${total[1]}`)
    console.log(`After ${numTransactions} transactions, change in balance is DAI:${deltaDAI}, WETH:${deltaWETH}\nExpected change was ${expected}`)

}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Script execution failed:", error);
        process.exit(1);
    });
















// May get rid of the percentage later to make it more accurate
// console.log("Exchange rate:", exchangeRateA);

// console.log(`${blue}INFO:${reset} Sending swap transaction with ${swapPath}, ${balance}`)
// let swap = executeSwap (
//     swapPath,
//     balance,
//     UniV2FactoryA_ADDRESS,
//     recipient,
//     fromThis,
//     currentNonce 
// )

// await Promise.all([swap]);

// console.log(`Balance of recipient after swap: ${await DAI.balanceOf(recipient)} DAI, and ${await WETH.balanceOf(recipient)} WETH`);
// // console.log(`Balance of contract after swap: ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`);
// console.log(`Balance of pairA after swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH`);


// async function executeSwap(swapPath, amountIn, factoryAddress, recipient, fromThis, gasPrice, nonce) {
//     try {
//         const swapTx = await AtomicSwap.connect(recipientWallet).swap(
//             swapPath,
//             amountIn,
//             factoryAddress,
//             recipient,
//             fromThis,
//             {
//                 // gasPrice: 301,
//                 nonce: nonce
//             }
//         );
//         console.log(`Swap transaction sent. Hash: ${swapTx.hash}`);
//         const swapReceipt = await swapTx.wait();
//         console.log(`Swap transaction confirmed in block ${yellow}${swapReceipt.blockNumber}${reset}`);
//         console.log(`${blue}INFO:${reset} Swapped ${balance} DAI for ${await WETH.balanceOf(recipient) - WETHbefore} WETH`)

//         return swapReceipt;
//     } catch (error) {
//         console.error(`Error executing swap with path ${swapPath}:`, error);
//         throw error; // Rethrow to let the caller handle it
//     }
// }

// // Add liquidity to the DAI/WETH pair
// async function addLiquidity(pairAddress, tokenAContract, tokenBContract, amountA, amountB, signer) {
//     try {
//         console.log(`\n--- Adding Liquidity ---`);
//         console.log(`Pair Address: ${pairAddress}`);
//         console.log(`Token A: ${tokenAContract}`);
//         console.log(`Token B: ${tokenBContract}`);
//         console.log(`Amount A (DAI): ${amountA}`);
//         console.log(`Amount B (WETH): ${amountB}`);

//         const balanceA = await tokenAContract.balanceOf(signer.address);
//         const balanceB = await tokenBContract.balanceOf(signer.address);
//         console.log(`TokenA Balance: ${balanceA} DAI`);
//         console.log(`TokenB Balance: ${balanceB} WETH`);

//         if (balanceA < amountA) {
//             throw new Error(`Insufficient TokenA balance. Required: ${ethers.formatUnits(amountA, 18)}, Available: ${balanceA}`);
//         }

//         if (balanceB < amountB) {
//             throw new Error(`Insufficient TokenB balance. Required: ${ethers.formatUnits(amountB, 18)}, Available: ${balanceB}`);
//         }

//         // Transfer TokenA to the pair contract
//         console.log(`Transferring ${amountA} DAI to Pair Address: ${pairAddress}`);
//         // Transfer TokenA to the pair contract
//         let tx = await tokenAContract.connect(signer).transfer(pairAddress, amountA);
//         await tx.wait();

//         console.log(`Transferring ${amountB} WETH to Pair Address: ${pairAddress}`);
//         // Transfer TokenB to the pair contract
//         tx = await tokenBContract.connect(signer).transfer(pairAddress, amountB);
//         await tx.wait();

//         // Create an instance of the pair contract
//         const pairContract = new ethers.Contract(pairAddress, pairABI, signer);

//         // Call mint on the pair contract
//         tx = await pairContract.mint(signer.address);
//         await tx.wait();
//         console.log(`Liquidity tokens minted and sent to ${pairAddress}`);

//         // Return the pair contract instantiated
//         return pairContract;
//     } catch (error) {
//         console.error("Error adding liquidity:", error);
//     }
// }

