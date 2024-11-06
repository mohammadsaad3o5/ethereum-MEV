from utility import decode_transaction_input
import time
import utility
from web3 import Web3
import os
import traceback

path = {"0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9": "DAI",
        "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105": "WETH"}
botAddress = "0x802dCbE1B1A97554B4F50DB5119E37E8e7336417"


w3 = Web3(Web3.HTTPProvider(utility.rpc_url))

def monitor_txpool():
    seen_transactions = set()  # To keep track of transactions already logged

    while True:
        try:
            # Get the content of the txpool
            txpool_content = w3.geth.txpool.content()

            # Check the pending transactions in the txpool
            for sender, txs in txpool_content['pending'].items():
                for nonce, tx in txs.items():
                    tx_hash = tx['hash']
                    if tx_hash not in seen_transactions:
                        seen_transactions.add(tx_hash)
                        # print(tx)
                        # Log the transaction details
                        print(
                            f"New transaction detected: ",
                            f"Hash: {tx_hash}, From: {tx['from']}, To: {tx.get('to', 'Contract Creation')}, ",
                            f"Value: {int(tx['value'], 16)} wei, gasPrice: {int(tx.get('gasPrice'), 16)}, nonce {int(tx['nonce'], 16)}"
                        )
                        function_call = decode_transaction_input(tx_hash)
                        print(function_call)
                        # print(tx)
                        if "swap" in function_call[0].fn_name:
                            rates = utility.get_exchange_rate()
                            if tx['from'].upper() != botAddress.upper():
                                with open("arbitrage.txt", 'a') as file:
                                    print("arbitrage opportunity!")

                                    # line = path.get(function_call[1]['path'][0]) + "," + path.get(function_call[1]['path'][1]) + "," + str(function_call[1]['amountIn']) + "," + str(int(tx.get('gasPrice', '0x0'), 16)-7) + "\n"
                                    line = path.get(function_call[1]['path'][0]) + "," + path.get(function_call[1]['path'][1]) + "," + str(function_call[1]['amountIn']) + "," + str(int(tx.get('gasPrice', '0x0'), 16)) + "\n"
                                    file.write(line)


        except Exception as e:
            print(f"Error monitoring txpool: {str(e)}")
            traceback.print_exc()

        # Wait before polling again (adjust as needed)
        time.sleep(0.3)

monitor_txpool()
# prev = ''
# while True:
#     pending = w3.geth.txpool.inspect()

#     if prev == pending:
#         pass
#     else:
#         prev = pending
#         print(prev)
#     time.sleep(1)

