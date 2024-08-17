import json
import requests
# every query is sent to the execution client
from web3 import Web3
from eth_account import Account

# Initialize Web3 instance
w3 = Web3(Web3.HTTPProvider("http://localhost:8545"))

def send_rpc_request(method, params=[]):
    # handles the rpc request format, calls just have to have the request and arguments
    url = "http://localhost:8545"
    headers = {'Content-Type': 'application/json'}
    data = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    }
    response = requests.post(url, headers=headers, data=json.dumps(data))
    return response.json()


def send_signed_transaction(private_key, to_address, value, gas, gas_price, nonce):
    # Prepare the transaction
    transaction = {
        'nonce': nonce,
        'gasPrice': Web3.toWei(gas_price, 'gwei'),
        'gas': gas,
        'to': to_address,
        'value': Web3.toWei(value, 'ether'),
        'data': b'',
    }

    # Sign the transaction
    signed_tx = w3.eth.account.sign_transaction(transaction, private_key)
    
    # Send the transaction
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    return tx_hash.hex()

def get_block(block_number):
    # gets the block number queried
    # forms a response string which is returned, None if the block is an invalid block
    block_number = hex(block_number)
    block_response = send_rpc_request("eth_getBlockByNumber", [block_number, True])
    response_string = ""
    if block_response.get("result") == None:
        # print("Block doesn't exist")
        return None
    elif 'result' in block_response:
        transactions = block_response['result']['transactions']
        response_string += f"Transactions in block {block_number}:\n"
        for tx in transactions:
            response_string += f"Transaction Hash: {tx['hash']}\n"
            response_string += f"From: {tx['from']}\n"
            response_string += f"To: {tx['to']}\n"
            response_string += f"Value: {tx['value']} wei\n"
            response_string += "-----------------------------\n"

    return response_string

def get_balance(address):
    # queries the balance for an account 
    balance_response = send_rpc_request("eth_getBalance", [address, "latest"])
    if 'result' in balance_response:
        balance_wei = int(balance_response['result'], 16)
        balance_ether = balance_wei / 1e18
        print(f"Balance of {address}: {balance_ether} Ether")
    else:
        print("Error:", balance_response)

def send_transaction(from_address, to_address, value):
    # send the transaction
    transaction_data = {
        'from': from_address,
        'to': to_address,
        'value': hex(int(value))  # Convert value to hex
    }
    send_transaction_response = send_rpc_request("eth_sendTransaction", [transaction_data])
    
    if 'error' in send_transaction_response:
        print('Error:', send_transaction_response['error'])
    else:
        print('Transaction hash:', send_transaction_response['result'])

if __name__ == "__main__":
    while True:
        # if run as main, keep asking what you want to do
        print("1: Send transaction (from address, to address, value = 200000 wei for now)")
        print("2: Get balance (address)")
        print("3: Get block details (number)")
        request = input("What do you want to do?: ")
        try: 
            if request == '1':
                priv = False
                from_address = input("From address: 0x123463a4b065722e99115d6c222f267d9cabb524 - by default (any key to decline)")
                if from_address == "":
                    from_address = "0x123463a4b065722e99115d6c222f267d9cabb524"
                else:
                    from_address = input("From address: 0x")
                    from_address += '0x'
                    priv = True
                if priv:
                    private_key = input("Private key: 0x")

                to_address = '0x' + input("To address: 0x")
                value = int(input("Value: "))
                if not priv:
                    send_transaction(from_address, to_address, value)
                else:
                    send_signed_transaction(private_key, to_address, value, '0x2710', '0x09184e72a000', '0x00')

            if request == '2':
                address = '0x' + input("Address (that you want to check the balance of): 0x")
                get_balance(address)

            if request == '3':
                block_number = int(input("Block number: "))
                response = get_block(block_number)
                print(response)
                
        except Exception as e:
            print(e)


