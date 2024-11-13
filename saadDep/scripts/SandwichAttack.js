const { ethers, getNamedAccounts, network } = require('hardhat');
const { setUnion } = require('mathjs');
const path = require("path");
const hardhatConfig = require(path.resolve(__dirname, "../hardhat.config.js"));
const fs = require('fs').promises;


// // Contract ABIs and addresses
// const DAI_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
// const WETH_ADDRESS = "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105";
// const UniV2FactoryA_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0";  
// const AtomicSwap_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C"; 
// const pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;
// Contract ABIs and addresses
const DAI_ADDRESS = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"; 
const WETH_ADDRESS = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0";
const UniV2FactoryA_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
// const UniV2FactoryB_ADDRESS = "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3"; 
const AtomicSwap_ADDRESS = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C"; 
const pairABI = require('/home/ubuntu/ethereum-MEV/saadDep/artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;
// Global scope
let AtomicSwap;
let recipientWallet;

function combineStrings(list) {
    // Create an object to hold grouped values
    const grouped = {};

    // Group the values by the first two elements
    list.forEach(item => {
        const [token1, token2, amountStr, valueStr] = item.split(",");
        const amount = BigInt(amountStr); // Parse as BigInt for precision
        const value = parseInt(valueStr);

        // Use a unique key for each token pair
        const key = `${token1},${token2}`;

        if (!grouped[key]) {
            grouped[key] = {
                token1,
                token2,
                totalAmount: amount,
                minValue: value,
                maxValue: value,
            };
        } else {
            grouped[key].totalAmount += amount;
            grouped[key].minValue = Math.min(grouped[key].minValue, value);
            grouped[key].maxValue = Math.max(grouped[key].maxValue, value);
        }
    });

    // Reformat the grouped values into the original string format
    return Object.values(grouped).map(({ token1, token2, totalAmount, minValue, maxValue }) => {
        return `${token1},${token2},${totalAmount.toString()},${minValue},${maxValue}`;
    });
}

async function main() {

    setup();    


    // console.log(await DAI.balanceOf(recipientWallet.address), await WETH.balanceOf(recipientWallet.address));
    // let balance = 3000n;
    // console.log(`INFO: Bot has ${balance} (per transaction) to work with`)
    // Balance of contract
    // console.log(`AtomicSwap contract has ${await DAI.balanceOf(AtomicSwap_ADDRESS)} DAI, and ${await WETH.balanceOf(AtomicSwap_ADDRESS)} WETH`)

    //Get the pair contract from factoryA
    const pairAddressA = await UniV2FactoryA.getPair(DAI_ADDRESS, WETH_ADDRESS);
    let pairContractA = new ethers.Contract(pairAddressA, pairABI, deployerWallet);
    console.log("Pair Address", pairAddressA)

    // Not the same as the flooder
    let recipient = recipientWallet.address;
    await approveToken(DAI, AtomicSwap_ADDRESS, ethers.MaxUint256, deployerWallet, "DAI");
    await approveToken(WETH, AtomicSwap_ADDRESS, ethers.MaxUint256, deployerWallet, "WETH");
        
    while (true) {
        
        // Transaction Batching
        read = false;
        while (!read) {
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
            await wait(1000);


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

        combinedTransactions = combineStrings(lines);
        // console.log(combinedTransactions);
        // Combine transactions of the same type together
        // for (const line of combinedTransactions) {
        //     console.log(line);
        // }
        if (combinedTransactions.length != 0) {
            console.log(combinedTransactions);
        }

        balanceDAIstart = await DAI.balanceOf(recipient);
        balanceWETHstart = await WETH.balanceOf(recipient);
        total = 0n;

        expected = 0n;
        for (const line of combinedTransactions) {
            // Need this to ensure the transactions aren't being nonce limited
            numTransactions = lines.length;
            // console.log(numTransactions)
            // get the deets
            lineArr = line.split(",");
            tokenA = lineArr[0];
            tokenB = lineArr[1];
            amount = Number(lineArr[2]);
            // Use combined transactions
            gasPriceLow = Number(lineArr[3]) - 1;
            gasPriceHigh = Number(lineArr[4]) + 1;

            // Keep track of the total  
            balance = BigInt(amount);
            balance = balance + BigInt(getRandomInt(1,100));
            total += balance;

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

            


            console.log(`INFO: Sending swap transaction with ${swapPath}, ${balance}, gasPriceHigh ${gasPriceHigh}, nonce:${currentNonce + step}`)
            let swap1 = AtomicSwap.swap(
                swapPath,
                balance,
                0n,
                UniV2FactoryA,
                recipient,
                false,
                { 
                    gasPrice: gasPriceHigh,
                    nonce: currentNonce + step++
                } 
            )
            // console.log(`Swap transaction sent. ${swap1.hash}`);

            // if the inital transaction was WETH to DAI then use the balance from DAI difference
            if (tokenA === "DAI") {
                // balance = await DAI.balanceOf(recipient) - DAIbefore;
                // DAI was user transaction
                // WETH -> DAI made first, hence change back DAI -> WETH
                balance = calculateExactOutputAmount(pair[0], pair[1], balance);
            } else {
                // balance = await WETH.balanceOf(recipient) - WETHbefore;
                balance = calculateExactOutputAmount(pair[1], pair[0], balance);
            }
            // add up the change
            expected += balance;

            console.log(`INFO: Sending swap transaction with ${reverse}, ${balance}, gasPriceLow ${gasPriceLow}, nonce:${currentNonce + step}`)
            let swap2 = AtomicSwap.swap(
                reverse,
                balance,
                0n,
                UniV2FactoryA,
                recipient,
                false, {
                    gasPrice: gasPriceLow,
                    nonce: currentNonce + step++
                }
            )

        }

        deltaDAI = await DAI.balanceOf(recipient) - balanceDAIstart;
        deltaWETH = await WETH.balanceOf(recipient) - balanceWETHstart;
        if (deltaDAI > 0n || deltaWETH > 0n) {
            console.log(`Amount exchanged (from the bot) DAI/WETH:${deltaDAI}, ${deltaWETH}`)
            console.log(`After ${step} transactions, change in balance is DAI:${deltaDAI}, WETH:${deltaWETH}\nExpected change was ${expected}`)
        }
        
    }
    

}

// async function handleSwap(swap1, swap2) {
//     let result = await swap1;
//     let receipt = await result.wait();
//     console.log(receipt);
//     result = await swap2;
//     receipt = result.wait();
//     console.log(receipt);
// }


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
        console.log(`something approved with transaction hash: ${receipt.transactionHash}`);
    } catch (error) {
        console.error(`Error approving "some" token:`, error);
    }
}

function setup() {
    // Set up provider and signers
    provider = new ethers.JsonRpcProvider(hardhatConfig.networks['local']['url']);
    factoryAdminPrivateKey = "0xdaf15504c22a352648a71ef2926334fe040ac1d5005019e09f6c979808024dc7";
    deployerPrivateKey = "0x5d2344259f42259f82d2c140aa66102ba89b57b4883ee441a8b312622bd42491";
    // deployer address = 0x802dCbE1B1A97554B4F50DB5119E37E8e7336417
    recipientPrivateKey = "0x5d2344259f42259f82d2c140aa66102ba89b57b4883ee441a8b312622bd42491";
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
    
    return amountOut;
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

