from utility import send_rpc_request
import time
import utility
from web3 import Web3



w3 = Web3(Web3.HTTPProvider(utility.rpc_url))

prev = ''
while True:
    pending = w3.geth.txpool.inspect()

    if prev == pending:
        pass
    else:
        prev = pending
        print(prev)
    time.sleep(9)

