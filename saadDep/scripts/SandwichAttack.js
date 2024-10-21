const { ethers, getNamedAccounts, network } = require('hardhat');
const { setUnion } = require('mathjs');
const path = require("path");
const hardhatConfig = require(path.resolve(__dirname, "../hardhat.config.js"));
const fs = require('fs').promises;


// Contract ABIs and addresses
const DAI_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"; 
const WETH_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C";
const UniV2FactoryA_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
const AtomicSwap_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
const pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;
// Global scope
let AtomicSwap;
let recipientWallet;

async function main() {

    setup();    

    let balance = 3000n;
    console.log(`INFO: Bot has ${balance} (per transaction) to work with`)
    // Balance of contract
    // console.log(`AtomicSwap contract has ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`)

    //Get the pair contract from factoryA
    const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);

    // Not the same as the flooder
    let recipient = recipientWallet.address;
    await approveToken(DAI, AtomicSwap_ADDRESS, ethers.MaxUint256, deployerWallet, "DAI");
    await approveToken(WETH, AtomicSwap_ADDRESS, ethers.MaxUint256, deployerWallet, "WETH");
        
    while (true) {
        // Make sure its the same (idk what this was referring to? probably removed it)

        read = false;
        while (!read) {
            await wait(1500);
            // Read and log the arbitrage.txt file
            lines = await readArbitrageFile("/home/ubuntu/ethereum-MEV/arbitrage.txt");
            // Need to make sure if there's more than one transaction in the same block doesn't reuse the nonces
            // If I end up batching the transactions then I won't need this
            prevNonce = 0;
            currentNonce = await provider.getTransactionCount(deployerWallet.address, "pending");
            if (currentNonce != prevNonce) {
                step = 0;
                prevNonce = currentNonce
            }
            // Parameter for transaction batching 

            linesRecheck = await readArbitrageFile("/home/ubuntu/ethereum-MEV/arbitrage.txt");
            if (JSON.stringify(lines) !== JSON.stringify(linesRecheck)) {
                // Reaching here means transaction just got added
                // So don't clear the file just yet, wait for it to refresh again and see if more transactions can be batched
                // Might add in a counter to make sure it doesn't just wait for transactions forever
                read = false;
                console.log("transaction batching", lines, linesRecheck, lines === linesRecheck)
            } else {
                // Nothing got added so lets go
                read = true;
                clearArbitrageFile("/home/ubuntu/ethereum-MEV/arbitrage.txt");
                // console.log("No transactions added in the frame so clear arbitrage file and move on")
            }
        }


        balanceDAIstart = await DAI.balanceOf(recipient);
        balanceWETHstart = await WETH.balanceOf(recipient);
        total = 0n;

        expected = 0n;
        for (const line of lines) {  
            // Need this to ensure the transactions aren't being nonce limited
            numTransactions = lines.length;
            console.log(numTransactions)
            balance = 3000n;
            balance = balance + BigInt(getRandomInt(1,100));
            total += balance;
            // get the deets
            lineArr = line.split(",");
            tokenA = lineArr[0];
            tokenB = lineArr[1];
            amount = Number(lineArr[2]);
            gasPrice = Number(lineArr[3]);
            

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
            // currentNonce = await provider.getTransactionCount(deployerWallet.address, "pending");

            //Get the pair contract from factoryA
            // console.log("Reserves A", currentNonce);
            pair = await pairContractA.getReserves();
            // console.log(pair[0], pair[1]);

            // if the inital transaction was WETH to DAI then use the balance from DAI difference
            if (tokenA === "DAI") {
                // balance = await DAI.balanceOf(recipient) - DAIbefore;
                // DAI was user transaction
                // WETH -> DAI made first, hence change back DAI -> WETH
                balance = calculateOutputAmount(pair[0], pair[1], amount);
            } else {
                // balance = await WETH.balanceOf(recipient) - WETHbefore;
                balance = calculateOutputAmount(pair[1], pair[0], amount);
            }
            // add up the change
            expected += balance;


            console.log(`INFO: Sending swap transaction with ${swapPath}, ${balance}, gasPrice ${gasPrice + 1}, nonce:${currentNonce + step}`)
            let swap1 = AtomicSwap.swap(
                swapPath,
                balance,
                UniV2FactoryA_ADDRESS,
                recipient,
                fromThis,
                { 
                    gasPrice: gasPrice + 1,
                    nonce: currentNonce + step
                } 
            )
            // console.log(`Swap transaction sent. ${swap1.hash}`);
            

            console.log(`INFO: Sending swap transaction with ${reverse}, ${balance}, gasPrice ${gasPrice - 1}, nonce:${currentNonce + step + numTransactions}`)
            let swap2 = AtomicSwap.swap(
                reverse,
                balance,
                UniV2FactoryA_ADDRESS,
                recipient,
                fromThis, {
                    gasPrice: gasPrice - 1,
                    nonce: currentNonce + step + numTransactions
                }
            )
            step += 1;

        }

        deltaDAI = await DAI.balanceOf(recipient) - balanceDAIstart;
        deltaWETH = await WETH.balanceOf(recipient) - balanceWETHstart;
        if (deltaDAI > 0n || deltaWETH > 0n) {
            console.log(`Amount exchanged (from the bot) DAI/WETH:${deltaDAI}, ${deltaWETH}`)
            console.log(`After ${step} transactions, change in balance is DAI:${deltaDAI}, WETH:${deltaWETH}\nExpected change was ${expected}`)
        }
        
    }
    

}

async function handleSwap(swap1, swap2) {
    let result = await swap1;
    let receipt = await result.wait();
    console.log(receipt);
    result = await swap2;
    receipt = result.wait();
    console.log(receipt);
}

// Approve token order through router
async function approveToken(tokenContract, spenderAddress, amount, signer, tokenLabel) {
    try {
        const allowance = await tokenContract.allowance(signer.address, spenderAddress);
        if (allowance >= amount/2n) {
            // console.log(`${tokenLabel} already approved for spender ${spenderAddress}, skipping approval.`);
            return;
        }
        console.log(`Approving ${tokenLabel} for spending by ${spenderAddress}...`);
        const tx = await tokenContract.approve(spenderAddress, amount);
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`${tokenLabel} approved with transaction hash: ${receipt.hash}`);
    } catch (error) {
        console.error(`Error approving ${tokenLabel}:`, error);
    }
}

function setup() {
    // Set up provider and signers
    provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
    factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";
    deployerPrivateKey = "0x5d2344259f42259f82d2c140aa66102ba89b57b4883ee441a8b312622bd42491";
    // deployer address = 0x802dCbE1B1A97554B4F50DB5119E37E8e7336417
    recipientPrivateKey = "0x6ecadc396415970e91293726c3f5775225440ea0844ae5616135fd10d66b5954";
    // recipient address = 0xfDCe42116f541fc8f7b0776e2B30832bD5621C85

    deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    recipientWallet = new ethers.Wallet(recipientPrivateKey, provider);
    factoryAdminWallet = new ethers.Wallet(factoryAdminPrivateKey, provider);

    console.log("(This is where the contract calls are made from) Deployer address:", deployerWallet.address);
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
        // Return the list of lines
        return nonEmptyLines;

    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return []
    }   
}

// Separating this from the read file function because of technicality mentioned in the nonce calculation part
async function clearArbitrageFile(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    await fs.truncate(filePath, 0);
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

