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

    // Set up provider and signers
    // console.log(hardhatConfig.networks['local']['url']);
    const provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
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

    // Define the amount to mint (1000 tokens with 18 decimals)
    const mintAmount = ethers.parseUnits("1000", 18); // 1000 DAI/WETH with 18 decimals

    // Create pairs in both factories
    await createPair(UniV2FactoryA, DAI_ADDRESS, WETH_ADDRESS, factoryAdminWallet, "A");
    await createPair(UniV2FactoryB, DAI_ADDRESS, WETH_ADDRESS, factoryAdminWallet, "B");

    // 2. Mint DAI tokens to deployer's address
    await mintDAI(DAI, deployerWallet.address, mintAmount);

    // 3. Mint WETH by sending ETH to WETH9 contract
    await mintWETH(WETH, mintAmount, deployerWallet);

    const maxApprovalAmount = ethers.MaxUint256;
    // 4. Approve tokens for AtomicSwap router
    await approveToken(DAI, AtomicSwap_ADDRESS, maxApprovalAmount, deployerWallet, "DAI");
    await approveToken(WETH, AtomicSwap_ADDRESS, maxApprovalAmount, deployerWallet, "WETH");

    // Add liquidity
    const DAIAmount = mintAmount;
    const WETHAmount = mintAmount/(1300n);

    //Get the pair contract from factoryA
    const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractA = await addLiquidity(pairAddressA, DAI, WETH, DAIAmount/(4n), WETHAmount/(4n), deployerWallet);
    // console.log("Reserves A");
    pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);
    console.log(await pairContractA.getReserves(), await pairContractA.kLast());



    const swapPath = [WETH_ADDRESS, DAI_ADDRESS];
    const recipient = deployerWallet.address;
    const fromThis = false; // Using sender's balance
    
    // Execute the swap
    const swapTx = await AtomicSwap.swap(
        swapPath,
        311313321,
        UniV2FactoryA,
        recipient,
        fromThis
    );
    console.log("Swap transaction sent. Waiting for confirmation...");
    const swapReceipt = await swapTx.wait();
    console.log(`Swap completed in block ${swapReceipt.blockNumber}`);

    console.log("Reserves A (after tx)");
    console.log(await pairContractA.getReserves(), await pairContractA.kLast());





    // Get pair contract from factoryB
    pairAddressB = await UniV2FactoryB.getPair(DAI_ADDRESS, WETH_ADDRESS);
    const pairContractB = await addLiquidity(pairAddressB, DAI, WETH, DAIAmount/(1n), WETHAmount/(8n), deployerWallet);
    console.log("Reserves B");
    console.log(await pairContractB.getReserves(), await pairContractB.kLast());
    
}

// Function to create a pair in a Uniswap V2 factory
async function createPair(factoryContract, tokenA, tokenB, signer, factoryLabel) {
    try {
        console.log(`Creating pair in Factory ${factoryLabel} for tokens ${tokenA} and ${tokenB}...`);

        // Check if the pair already exists to ensure idempotency
        const pairAddress = await factoryContract.getPair(tokenA, tokenB);
        if (pairAddress !== ethers.ZeroAddress) {
            console.log(`Pair already exists at address ${pairAddress}, skipping creation.`);
            return;
        }

        const tx = await factoryContract.createPair(tokenA, tokenB);
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Pair created in Factory ${factoryLabel} with transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
        console.error(`Error creating pair in Factory ${factoryLabel}:`, error);
    }
}

async function executeSwap(contract) {
  // Define the parameters
  
  try {
    // Optional: Estimate gas
    const gasEstimate = await contract.estimateGas.swap(amount0Out, amount1Out, to, data);
    
    console.log("GasEstimate", gasEstimate);

  } catch (error) {
    console.error("Error executing swap:", error);
  }
}
// Mint DAI tokens
async function mintDAI(DAIContract, toAddress, amount) {
    try {
        const currentBalance = await DAIContract.balanceOf(toAddress);

        // console.log(typeof(currentBalance));
        if (currentBalance >= amount) {
            console.log(`DAI balance is sufficient (${currentBalance} DAI), skipping minting.`);
            return;
        }
        
        const mintAmount = amount - currentBalance;

        console.log(`Minting ${mintAmount} DAI to ${toAddress}...`);
        const tx = await DAIContract.mint(toAddress, mintAmount);
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`DAI minted with transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
        console.error("Error minting DAI:", error);
    }
}

// Mint WETH by sending ETH
async function mintWETH(WETHContract, amount, signer) {
    try {
        const currentBalance = await WETHContract.balanceOf(signer.address);
        if (currentBalance >= amount) {
            console.log(`WETH balance is sufficient (${currentBalance} WETH), skipping minting.`);
            return;
        }

        const mintAmount = amount - currentBalance;

        // console.log(await WETH_ADDRESS)
        console.log(`Minting ${mintAmount} WETH by sending ETH to WETH contract...`);
        const tx = await signer.sendTransaction({
            to: WETH_ADDRESS,
            value: mintAmount
        });
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`WETH minted with transaction hash: ${receipt.transactionHash}`);


    } catch (error) {
        console.error("Error minting WETH:", error);
    }
}

// Approve token order through router
async function approveToken(tokenContract, spenderAddress, amount, signer, tokenLabel) {
    try {
        console.log(`Approving ${tokenLabel} for spending by ${spenderAddress}...`);
        const allowance = await tokenContract.allowance(signer.address, spenderAddress);
        if (allowance > amount) {
            console.log(`${tokenLabel} already approved for spender ${spenderAddress}, skipping approval.`);
            return;
        }
        const tx = await tokenContract.approve(spenderAddress, amount);
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`${tokenLabel} approved with transaction hash: ${typeof(receipt)}`);
    } catch (error) {
        console.error(`Error approving ${tokenLabel}:`, error);
    }
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

        // Transfer TokenA to the pair contract
        console.log(`Transferring ${amountA} DAI to Pair Address: ${pairAddress}`);
        // Transfer TokenA to the pair contract
        let tx = await tokenAContract.connect(signer).transfer(pairAddress, amountA);
        await tx.wait();

        console.log(`Transferring ${amountB} WETH to Pair Address: ${pairAddress}`);
        // Transfer TokenB to the pair contract
        tx = await tokenBContract.connect(signer).transfer(pairAddress, amountB);
        await tx.wait();

        // Create an instance of the pair contract
        const pairContract = new ethers.Contract(pairAddress, pairABI, signer);

        // Call mint on the pair contract
        tx = await pairContract.mint(signer.address);
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
