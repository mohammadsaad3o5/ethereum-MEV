const { ethers } = require('hardhat');
// Contract ABIs and addresses
const DAI_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"; 
const WETH_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3";
const UniV2FactoryA_ADDRESS = "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105"; 
const UniV2FactoryB_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C"; 
const AtomicSwap_ADDRESS = "0xB74Bb6AE1A1804D283D17e95620dA9b9b0E6E0DA"; 
const pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;

async function main() {

    // Set up provider and signers
    const provider = new ethers.JsonRpcProvider("http://localhost:32888");
    const deployerPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";
    const factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";

    if (!deployerPrivateKey || !factoryAdminPrivateKey) {
        throw new Error("Please set DEPLOYER_PRIVATE_KEY and FACTORY_ADMIN_PRIVATE_KEY in your .env file");
    }

    const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    const factoryAdminWallet = new ethers.Wallet(factoryAdminPrivateKey, provider);

    console.log("Deployer address:", deployerWallet.address);
    console.log("Factory Admin address:", factoryAdminWallet.address);

    // Load contract ABIs 
    const DAI_ABI = require('../artifacts/contracts/DAI.sol/Dai.json').abi;
    const WETH_ABI = require('../artifacts/contracts/weth.sol/WETH9.json').abi;
    const UniV2Factory_ABI = require('../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json').abi;
    const AtomicSwap_ABI = require('../artifacts/contracts/atomicSwap.sol/AtomicSwap.json').abi;

    // Create contract instances connected to appropriate signers
    const DAI = new ethers.Contract(DAI_ADDRESS, DAI_ABI, deployerWallet);
    const WETH = new ethers.Contract(WETH_ADDRESS, WETH_ABI, deployerWallet);
    const UniV2FactoryA = new ethers.Contract(UniV2FactoryA_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
    const UniV2FactoryB = new ethers.Contract(UniV2FactoryB_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
    const AtomicSwap = new ethers.Contract(AtomicSwap_ADDRESS, AtomicSwap_ABI, deployerWallet);


    // Calculate amountOutMin based on current reserves to prevent front-running and slippage
    const reservesA = await getReserves(pairContractA, DAI_ADDRESS, WETH_ADDRESS);
    const reservesB = await getReserves(pairContractB, DAI_ADDRESS, WETH_ADDRESS);

    const amountOutMinA = calculateAmountOut(swapAmount, reservesA.reserveDAI, reservesA.reserveWETH);
    const amountOutMinB = calculateAmountOut(swapAmount, reservesB.reserveDAI, reservesB.reserveWETH);

    console.log(`Amount Out Min on Factory A: ${ethers.formatUnits(amountOutMinA, 18)} WETH`);
    console.log(`Amount Out Min on Factory B: ${ethers.formatUnits(amountOutMinB, 18)} WETH`);

    // Perform Swap on Factory A
    console.log("\n--- Swapping 1000 DAI for WETH on Factory A ---");
    const txA = await SwapHelper.swapDAIForWETH(pairAddressA, swapAmount, amountOutMinA, DAI_ADDRESS, WETH_ADDRESS);
    console.log(`Transaction submitted on Factory A: ${txA.hash}`);
    const receiptA = await txA.wait();
    console.log(`Swap executed on Factory A with transaction hash: ${receiptA.transactionHash}`);

    // Perform Swap on Factory B
    console.log("\n--- Swapping 1000 DAI for WETH on Factory B ---");
    const txB = await SwapHelper.swapDAIForWETH(pairAddressB, swapAmount, amountOutMinB, DAI_ADDRESS, WETH_ADDRESS);
    console.log(`Transaction submitted on Factory B: ${txB.hash}`);
    const receiptB = await txB.wait();
    console.log(`Swap executed on Factory B with transaction hash: ${receiptB.transactionHash}`);

    // Fetch and display the new reserves
    console.log("\n--- Updated Reserves After Swaps ---");
    const updatedReservesA = await pairContractA.getReserves();
    const updatedReservesB = await pairContractB.getReserves();

    console.log("Factory A Reserves:");
    console.log(`DAI: ${ethers.formatUnits(updatedReservesA.reserve0, 18)}`);
    console.log(`WETH: ${ethers.formatUnits(updatedReservesA.reserve1, 18)}`);
    console.log(`kLast: ${updatedReservesA.kLast}`);

    console.log("\nFactory B Reserves:");
    console.log(`DAI: ${ethers.formatUnits(updatedReservesB.reserve0, 18)}`);
    console.log(`WETH: ${ethers.formatUnits(updatedReservesB.reserve1, 18)}`);
    console.log(`kLast: ${updatedReservesB.kLast}`);

    // Calculate and display the differences
    const wethReceivedA = updatedReservesA.reserve1 - reservesA.reserveWETH;
    const wethReceivedB = updatedReservesB.reserve1 - reservesB.reserveWETH;

    console.log("\n--- WETH Received from Swaps ---");
    console.log(`Factory A: ${ethers.formatUnits(wethReceivedA, 18)} WETH`);
    console.log(`Factory B: ${ethers.formatUnits(wethReceivedB, 18)} WETH`);
    
}

// Function to get reserves and map to DAI and WETH
async function getReserves(pairContract, DAI_ADDRESS, WETH_ADDRESS) {
    const reserves = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();

    let reserveDAI, reserveWETH;

    if (token0.toLowerCase() === DAI_ADDRESS.toLowerCase()) {
        reserveDAI = reserves.reserve0;
        reserveWETH = reserves.reserve1;
    } else {
        reserveDAI = reserves.reserve1;
        reserveWETH = reserves.reserve0;
    }

    return {
        reserveDAI: reserveDAI,
        reserveWETH: reserveWETH
    };
}

// Function to calculate amount out based on Uniswap V2 formula
function calculateAmountOut(amountIn, reserveIn, reserveOut) {
    const amountInWithFee = BigInt(amountIn) * 997n;
    const numerator = amountInWithFee * BigInt(reserveOut);
    const denominator = (BigInt(reserveIn) * 1000n) + amountInWithFee;
    return numerator / denominator;
}
