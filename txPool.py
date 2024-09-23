from utility import decode_transaction_input
import time
import utility
from web3 import Web3




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

                        # Log the transaction details
                        print(
                            f"New transaction detected: ",
                            f"Hash: {tx_hash}, From: {tx['from']}, To: {tx.get('to', 'Contract Creation')}, ",
                            f"Value: {int(tx['value'], 16)} wei"
                        )
                        print(decode_transaction_input(tx_hash))

        except Exception as e:
            print(f"Error monitoring txpool: {str(e)}")

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

