const { ethers, getNamedAccounts, network } = require('hardhat');
const path = require("path");
const hardhatConfig = require(path.resolve(__dirname, "../hardhat.config.js"));


// Contract ABIs and addresses
const DAI_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"; 
const WETH_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C";
const UniV2FactoryA_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
const UniV2FactoryB_ADDRESS = "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105"; 
const AtomicSwap_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
const pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;

async function main() {

    setup()

    // Add liquidity
    const DAIAmount = 100000n;
    const WETHAmount = 250000n;

    //Get the pair contract from factoryA
    const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);

    // Fetch current reserves
    const [reserve0_current, reserve1_current, ] = await pairContractA.getReserves();

    // Desired reserves (convert to BigInt)
    const reserve0_desired = BigInt(100000);
    const reserve1_desired = BigInt(250000);

    // Calculate amounts to remove (convert all calculations to BigInt)
    let amount0 = reserve0_desired - BigInt(reserve0_current);
    let amount1 = reserve1_desired - BigInt(reserve1_current);

    console.log(amount0, amount1);
    if (amount0 < 0n) {
        amount0 = 0n;
    }
    if (amount1 < 0n) {
        amount1 = 0n;
    }
    // await addLiquidity(pairAddressA, DAI, WETH, amount0, amount1, deployerWallet);

   

    // console.log(reserve0_current, reserve1_current, liquidityToBurn);

    // Approve the pair contract to spend liquidity tokens if not already approved
    // const approveTx = await pairContractA.approve(pairAddressA, liquidityToBurn);
    // await approveTx.wait();

    // Call the burn function
    recipient = deployerWallet.address; // Or any address you want the tokens sent to
    // const burnTx = await pairContractA.burn(recipient, {
        // gasLimit: 1000000 // Adjust gas limit as needed
    // });
    // const burnReceipt = await burnTx.wait();
    // console.log(`Burn transaction confirmed in block ${burnReceipt.blockNumber}`);


    amt = 50000n

    // Verify the new reserves
    const [newReserve0, newReserve1, ] = await pairContractA.getReserves();

    precision = BigInt(10**6)
    console.log(`New Reserves: Token0:${newReserve0}, Token1:${newReserve1}
        should get ${calculateOutputAmount(newReserve0, newReserve1, amt)}`);

    // Start the calculations
    recipient = "0xD8F3183DEF51A987222D845be228e0Bbb932C222";
    // console.log(`Balance of DAI: ${await DAI.balanceOf(recipient)}, WETH: ${await WETH.balanceOf(recipient)} before swap`);
    balanceDAIstart = await DAI.balanceOf(recipient);
    balanceWETHstart = await WETH.balanceOf(recipient);

    let swapPath = [DAI_ADDRESS, WETH_ADDRESS];
    const fromThis = false; // Using sender's balance
    
    await wait(1000);  
    // Execute the swap
    let swapTx = await AtomicSwap.swap(
        swapPath,
        amt,
        UniV2FactoryA,
        recipient,
        fromThis
    );
    console.log(`Swap transaction sent. Waiting for confirmation... ${swapTx.hash}`);
    let swapReceipt = await swapTx.wait();
    console.log(`Swap completed in block ${swapReceipt.blockNumber}`);
    console.log(`Change in balance of DAI: ${await DAI.balanceOf(recipient) - balanceDAIstart}, WETH: ${await WETH.balanceOf(recipient) - balanceWETHstart} after swap`);

    console.log("Reserves A (after tx)");
    console.log(await pairContractA.getReserves(), await pairContractA.kLast());

    // let tx = await DAI.connect(deployerWallet).transfer(recipient, 5000n);
    // await tx.wait();
    // console.log("Balance of DAI after transfer:", await DAI.balanceOf(recipient));

    
}


function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

const amountA_in_after_fee = (amountA_in * 997n) / 1000n;

// Constant product formula: (reserveA + amountA_in) * new_reserveB = reserveA * reserveB
// Rearranged to solve for new_reserveB:
const new_reserveB = (reserveA * reserveB) / (reserveA + amountA_in_after_fee);

// The amount of token B that will be provided is the difference between initial and new reserveB
const amountB_out = reserveB - new_reserveB;

return amountB_out;
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


// Add liquidity to the DAI/WETH pair
async function addLiquidity(pairAddress, tokenAContract, tokenBContract, amountA, amountB, signer) {
    try {
        console.log(`\n--- Adding Liquidity ---`);
        console.log(`Pair Address: ${pairAddress}`);
        console.log(`Token A: ${tokenAContract}`);
        console.log(`Token B: ${tokenBContract}`);
        console.log(`Amount A (DAI): ${amountA}`);
        console.log(`Amount B (WETH): ${amountB}`);

        const balanceA = await tokenAContract.balanceOf(signer.address);
        const balanceB = await tokenBContract.balanceOf(signer.address);
        console.log(`TokenA Balance: ${balanceA} DAI`);
        console.log(`TokenB Balance: ${balanceB} WETH`);

        if (balanceA < amountA) {
            throw new Error(`Insufficient TokenA balance. Required: ${ethers.formatUnits(amountA, 18)}, Available: ${balanceA}`);
        }

        if (balanceB < amountB) {
            throw new Error(`Insufficient TokenB balance. Required: ${ethers.formatUnits(amountB, 18)}, Available: ${balanceB}`);
        }

        // Don't transfer 0 tokens and waste time
        if (amountA > 0n) {
            // Transfer TokenA to the pair contract
            console.log(`Transferring ${amountA} DAI to Pair Address: ${pairAddress}`);
            // Transfer TokenA to the pair contract
            let tx = await tokenAContract.connect(signer).transfer(pairAddress, amountA);
            await tx.wait();
        }

        if (amountB > 0n) {
            console.log(`Transferring ${amountB} WETH to Pair Address: ${pairAddress}`);
            // Transfer TokenB to the pair contract
            tx = await tokenBContract.connect(signer).transfer(pairAddress, amountB);
            await tx.wait();
        }

        // Create an instance of the pair contract
        const pairContract = new ethers.Contract(pairAddress, pairABI, signer);

        // Call mint on the pair contract
        // tx = await pairContract.mint(signer.address);

        await tx.wait();
        console.log(`Liquidity tokens minted and sent to ${pairAddress}`);

        // Return the pair contract instantiated
        return pairContract;
    } catch (error) {
        console.error("Error adding liquidity:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Script execution failed:", error);
        process.exit(1);
    });
