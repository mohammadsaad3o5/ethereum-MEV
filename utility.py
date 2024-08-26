import json
import requests
# every query is sent to the execution client
from web3 import Web3
from eth_account import Account
import hashlib
from web3.middleware import construct_sign_and_send_raw_middleware


rpc_url = "http://localhost:33020"

# Initialize Web3 instance
w3 = Web3(Web3.HTTPProvider(rpc_url))

def send_rpc_request(method, params=[]):
    # handles the rpc request format, calls just have to have the request and arguments
    
    headers = {'Content-Type': 'application/json'}
    data = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    }
    response = requests.post(rpc_url, headers=headers, data=json.dumps(data))
    return response.json()


def send_signed_transaction(private_key, to_address, value):
    # Initialize Web3 instance again because apparently it resets after 500 calls
    # and I am planning on using this to spam hehe
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    sender_account = w3.eth.account.from_key(private_key)

    w3.middleware_onion.add(construct_sign_and_send_raw_middleware(sender_account))

    transaction = {
        "from": sender_account.address,
        "value": hex(value),
        "to": to_address,
        "data": "0xabcd",
        "gasPrice": w3.eth.gas_price,
    }

    estimated_gas = w3.eth.estimate_gas(transaction)


    transaction["gas"] = estimated_gas

    tx_hash = w3.eth.send_transaction(transaction)

    tx = w3.eth.get_transaction(tx_hash)
    print(tx)
    return tx_hash.hex()
    
    # # Prepare the transaction
    # from random import randint
    # transaction = {
    #     'nonce': randint(10, 1000000),
    #     "gasPrice": w3.eth.gas_price,
    #     'to': to_address,
    #     'value': hex(value), 
    #     'data': b'',
    # }
    # estimated_gas = w3.eth.estimate_gas(transaction)
    # transaction["gas"] = estimated_gas

    # # Sign the transaction
    # signed_tx = w3.eth.account.sign_transaction(transaction, private_key)
    
    # # Send the transaction
    # tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    # print('gas:', transaction["gas"])
    # print("gas price:", transaction['gasPrice'])
    # return tx_hash.hex()

def get_block(block_number):
    # gets the block number queried
    # forms a response string which is returned, None if the block is an invalid block
    block_number = hex(block_number)
    block_response = send_rpc_request("eth_getBlockByNumber", [block_number, True])
    response_string = ""
    print(block_response)
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


def pubKey_to_address(public_key_hex):
    # Convert to bytes
    public_key_bytes = bytes.fromhex(public_key_hex)
    # Hash the public key using Keccak-256
    keccak_hash = hashlib.sha3_256(public_key_bytes).digest()
    # Take the last 20 bytes of the hash to get the Ethereum address
    eth_address = '0x' + keccak_hash[-20:].hex()
    # print("Derived Ethereum Address:", eth_address)
    return eth_address


if __name__ == "__main__":
    while True:
        # if run as main, keep asking what you want to do
        print("1: Send transaction (from address, to address, value = 200000 wei for now)")
        print("2: Get balance (address)")
        print("3: Get block details (number)")
        request = input("What do you want to do?: ")
        try: 
            if request == '1':

                # from_address = '0x'+ input("From address: 0x")
                # # if pubKey provided then convert to etheruem address
                # if len(from_address) > 40:
                #     from_address = pubKey_to_address(from_address[2:])
                private_key = input('Private key: ')
                to_address = '0x' + input("To address: 0x")

                # if pubKey provided then convert to etheruem address
                # if len(to_address) > 40:
                #     to_address = pubKey_to_address(to_address[2:])

                value = int(input("Value: "))
                # assume for now that EL has all the keys loaded up
                # send_transaction(from_address, to_address, value)
                hex = send_signed_transaction(private_key, to_address, value)
                print(hex)

            if request == '2':
                address = '0x' + input("Address (that you want to check the balance of): 0x")
                get_balance(address)

            if request == '3':
                block_number = int(input("Block number: "))
                response = get_block(block_number)
                print(response)
                
        except Exception as e:
            print(e)


