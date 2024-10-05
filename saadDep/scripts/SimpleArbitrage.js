const { ethers, getNamedAccounts, network } = require('hardhat');
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

async function main() {

    // Read and log the arbitrage.txt file
    lines = await readArbitrageFile("/home/ubuntu/ethereum-MEV/arbitrage.txt");
    // console.log(lines)

    // Set up provider and signers
    const provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
    const factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";
    const deployerPrivateKey = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23";
    const recipientPrivateKey = "0x6ecadc396415970e91293726c3f5775225440ea0844ae5616135fd10d66b5954";

    if (!deployerPrivateKey || !recipientPrivateKey) {
        throw new Error("Please set DEPLOYER_PRIVATE_KEY and FACTORY_ADMIN_PRIVATE_KEY in your .env file");
    }

    const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    const recipientWallet = new ethers.Wallet(recipientPrivateKey, provider);
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
    const WETH = new ethers.Contract(WETH_ADDRESS, WETH_ABI, deployerWallet);
    const UniV2FactoryA = new ethers.Contract(UniV2FactoryA_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
    const UniV2FactoryB = new ethers.Contract(UniV2FactoryB_ADDRESS, UniV2Factory_ABI, factoryAdminWallet);
    const AtomicSwap = new ethers.Contract(AtomicSwap_ADDRESS, AtomicSwap_ABI, deployerWallet);

    const balance = 10000000n;
    console.log(`INFO: Recipient has ${balance} to work with`)
    // Balance of contract
    console.log(`AtomicSwap contract has ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`)

    const mintAmount = ethers.parseUnits("1000", 18); 
    if (await WETH.balanceOf(AtomicSwap_ADDRESS) < mintAmount) { 
        // Transfer WETH to the contract so I can swap WETH -> DAI using contract balance
        tx = await WETH.transfer(AtomicSwap_ADDRESS, mintAmount);
        txReciept = await tx.wait()
        console.log(`WETH transferred to atomicSwap contract ${txReciept.hash}`)
    }
    if (await DAI.balanceOf(AtomicSwap_ADDRESS) < mintAmount) { 
        // Transfer DAI to the contract
        tx = await DAI.transfer(AtomicSwap_ADDRESS, mintAmount);
        txReciept = await tx.wait()
        console.log(`DAI transferred to atomicSwap contract ${txReciept.hash}`)
    }

    //Get the pair contract from factoryA
    const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);
    console.log("Reserves A");
    let pair = await pairContractA.getReserves();
    console.log(pair[0], pair[1]);
    exchangeRateA = ((pair[0]/pair[1])*(997n))/1000n;

    // May get rid of the percentage later to make it more accurate
    console.log("exchange rate", exchangeRateA);
    const pairAddressB = await UniV2FactoryB.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractB = new ethers.Contract(pairAddressB, pairABI, deployerWallet);
    console.log("Reserves B");
    pair = await pairContractB.getReserves();
    console.log(pair[0], pair[1]);
    exchangeRateB = ((pair[0]/pair[1])*(997n))/1000n;
    console.log("exchange rate", exchangeRateB);

    let recipient = "0xfDCe42116f541fc8f7b0776e2B30832bD5621C85";

    // await mintDAI(DAI, AtomicSwap_ADDRESS, (5n)*mintAmount);
    // Can't mint, so will just transfer from deployer wallet
    // await mintWETH(WETH, (5n)*mintAmount, AtomicSwap_ADDRESS);
    console.log(`Total supply of WETH in the system is ${await WETH.totalSupply()}, and DAI is ${await DAI.totalSupply()}`);

    

    // Approve deployerWallet to make transactions on behalf of the recipient (in the case I need 
    // to make atomicSwap)
    const maxApprovalAmount = ethers.MaxUint256;
    await approveToken(DAI, deployerWallet.address, maxApprovalAmount, recipientWallet, "DAI");
    await approveToken(WETH, deployerWallet.address, maxApprovalAmount, recipientWallet, "WETH");


    // Clear the balance of recipient before transactions
    if (await WETH.balanceOf(recipient) > 1n) {
        tx = await WETH.connect(recipientWallet).transfer(deployerWallet.address, await WETH.balanceOf(recipient));
        txReciept = await tx.wait()
        console.log(`WETH cleared from recipient ${txReciept.hash}`)
    }
    if (await DAI.balanceOf(recipient) > 1n) {
        tx = await DAI.connect(recipientWallet).transfer(deployerWallet.address, await DAI.balanceOf(recipient));
        txReciept = await tx.wait()
        console.log(`DAI cleared from recipient ${txReciept.hash}`)
    }
    
    console.log(`Balance of pairA before swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH` );

    console.log(`Balance of recipient before swap: ${await DAI.balanceOf(recipient) + balance} DAI, and ${await WETH.balanceOf(recipient)} WETH` );

    // Swap DAI to WETH at the exchange rate from pair A
    // swapPath = [WETH_ADDRESS, DAI_ADDRESS];
    swapPath = [DAI_ADDRESS, WETH_ADDRESS];
    fromThis = true;    
    swapTx = await AtomicSwap.connect(recipientWallet).swap(
        swapPath,
        balance,
        UniV2FactoryA,
        recipient,
        fromThis,
        {
        gasPrice: ethers.parseUnits("50", "gwei")
        }
    );
    console.log(`Swap transaction sent. Waiting for confirmation... ${swapTx.hash}`);
    swapReceipt = await swapTx.wait();
    console.log(`Swap completed in block ${swapReceipt.blockNumber}`);
    console.log(`Balance of recipient after swap: ${await DAI.balanceOf(recipient)} DAI, and ${await WETH.balanceOf(recipient)} WETH`);
    console.log(`Balance of pairA after swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH`);



    console.log(`Balance of pairB before swap: ${await DAI.balanceOf(pairAddressB)} DAI, and ${await WETH.balanceOf(pairAddressB)} WETH` );
    
    // Swap WETH to DAI at the exchange rate from pair A
    swapPath = [WETH_ADDRESS, DAI_ADDRESS];
    // swapPath = [DAI_ADDRESS, WETH_ADDRESS];
    fromThis = false;    
    swap2 = await WETH.balanceOf(recipient);
    swapTx = await AtomicSwap.swap(
        swapPath,
        await WETH.balanceOf(recipient),
        UniV2FactoryB,
        recipient,
        fromThis,
        {
        gasPrice: ethers.parseUnits("50", "gwei")
        // gasLimit: 1000000, 
        }
    );
    console.log(`Swap transaction sent. Waiting for confirmation... ${swapTx.hash}`);
    swapReceipt = await swapTx.wait();
    console.log(`Swap completed in block ${swapReceipt.blockNumber}`);
    console.log(`Balance of recipient after swap: ${await DAI.balanceOf(recipient)} DAI, and ${await WETH.balanceOf(recipient) - swap2} WETH`);
    console.log(`Profit: ${await DAI.balanceOf(recipient) - balance} DAI`);
    console.log(`Balance of pairA after swap: ${await DAI.balanceOf(pairAddressA)} DAI, and ${await WETH.balanceOf(pairAddressA)} WETH`);



}

// Function to read and log the contents of arbitrage.txt
async function readArbitrageFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        // console.log(`Contents of ${filePath}:`);
        // console.log(data);
        // Split the data into lines. This handles both Unix (\n) and Windows (\r\n) line endings.
        const lines = data.split(/\r?\n/);

        // Optionally, filter out any empty lines (if desired)
        const nonEmptyLines = lines.filter(line => line.trim() !== '');

        // Log the lines (optional)
        console.log(`Contents of ${filePath}:`);
        console.log(nonEmptyLines);

        // Return the list of lines
        return nonEmptyLines;

    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);

        return []
    }
}


// Approve token order through router
async function approveToken(tokenContract, spenderAddress, amount, signer, tokenLabel) {
    try {
        console.log(`Approving ${tokenLabel} for spending by ${spenderAddress}...`);
        const allowance = await tokenContract.allowance(signer.address, spenderAddress);
        if (allowance >= amount) {
            console.log(`${tokenLabel} already approved for spender ${spenderAddress}, skipping approval.`);
            return;
        }
        const tx = await tokenContract.approve(spenderAddress, amount, {
            gasPrice: ethers.parseUnits("510", "gwei"), 
            gasLimit: 1000000, 
            });
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`${tokenLabel} approved with transaction hash: ${receipt.hash}`);
    } catch (error) {
        console.error(`Error approving ${tokenLabel}:`, error);
    }
}

// Mint DAI tokens
async function mintDAI(DAIContract, toAddress, amount) {
    try {
        const currentBalance = await DAIContract.balanceOf(toAddress);
        if (currentBalance >= amount) {
            console.log(`DAI balance is sufficient (${currentBalance} DAI), skipping minting.`);
            return;
        }
        
        const mintAmount = amount - currentBalance;

        console.log(`Minting ${mintAmount} DAI to ${toAddress}...`);
        const tx = await DAIContract.mint(toAddress, mintAmount);
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`DAI minted with transaction hash: ${receipt.hash}`);
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
        console.log(`WETH minted with transaction hash: ${receipt.hash}`);


    } catch (error) {
        console.error("Error minting WETH:", error);
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Script execution failed:", error);
        process.exit(1);
    });


// approveToken(WETH, AtomicSwap_ADDRESS, maxApprovalAmount, recipientWallet, "WETH");
// approveToken(DAI, AtomicSwap_ADDRESS, maxApprovalAmount, recipientWallet, "DAI");