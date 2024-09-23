import json
import requests
import re
from eth_abi.exceptions import ABITypeError
from eth_abi import encode
from eth_utils import function_signature_to_4byte_selector, keccak
# every query is sent to the execution client
from web3 import Web3
from eth_account import Account
import hashlib
from web3.middleware import construct_sign_and_send_raw_middleware
from eth_utils import to_checksum_address
import rlp


'''
0x1CD4aF4A9bF33474C802d31790A195335f7a9Ab8 - DAI (deployed first)
0xd676AF79742bCAeb4a71CF62b85d5ba2D1deaf86 - DAI // this contract only takes in ether
0x154E2238a212Ee4209111D2F3F6351D80e5d74B6 - uniV2FactoryB // takes a call once, probably liquidity pool stuff
0xB77d61Ea79c7Ea8bfa03d3604Ce5EaBfb95C2aB2 - uniV2FactoryA // takes in a call once, same as above
0x6C6340BA1Dc72c59197825cD94EcCC1f9c67416e - atomicSwap // only used in contract calls
0x991145EA701D75fC8352c32Ac8728A335F8f0fb9 - daiWethA // minted once (so call to contract) and rest used in calls
0x3676554055b1c713A5A19C574baA3186B3DCB8d8 - daiWethB // minted once (so call to contract) and rest used in calls
'''
rpc_url = "http://localhost:32783"

# 0x7ff1a4c1d57e5e784d327c4c7651e952350bc271f156afb3d00d20f5ef924856 - contract owner
# 0x3a91003acaf4c21b3953d94fa4a6db694fa69e5242b2e37be05dd82761058899 - normal user

# ./bin/run init -r http://172.16.0.10:8545 -k 0x7ff1a4c1d57e5e784d327c4c7651e952350bc271f156afb3d00d20f5ef924856 -u 0x3a91003acaf4c21b3953d94fa4a6db694fa69e5242b2e37be05dd82761058899 -s deployment.json

# ./bin/run spam -r http://172.16.0.10:8545 -k 0x7ff1a4c1d57e5e784d327c4c7651e952350bc271f156afb3d00d20f5ef924856 -u 0x3a91003acaf4c21b3953d94fa4a6db694fa69e5242b2e37be05dd82761058899 -l deployment.json 

# Initialize Web3 instance
w3 = Web3(Web3.HTTPProvider(rpc_url))

contract_list = []

# Load the contract ABI
with open('DAI.json', 'r') as abi_file:
    dai_contract_abi = json.load(abi_file)['abi']
with open('UniSwapFactory.json', 'r') as abi_file:
    factory_abi = json.load(abi_file)['abi']


# Load the contracts into a list
dai_contract_address = "0x16905D41f37F1ae5801C818046f978D8092eba18" #'0xd676AF79742bCAeb4a71CF62b85d5ba2D1deaf86'
common_contract_address = "0x16905D41f37F1ae5801C818046f978D8092eba18" 
dai_contract = w3.eth.contract(address=dai_contract_address, abi=dai_contract_abi)
contract_list.append(dai_contract)
# factory_contract_address = "0x154E2238a212Ee4209111D2F3F6351D80e5d74B6"
# factory_contract = w3.eth.contract(address=factory_contract_address, abi=factory_abi)
# contract_list.append(factory_contract)

# # Path to the 'abi' folder
# abi_folder = 'abi'
# import os
# # Iterate through all files in the 'abi' folder
# for filename in os.listdir(abi_folder):
#     if filename.endswith('.json'):
#         abi_path = os.path.join(abi_folder, filename)
        
#         # Load the ABI from the JSON file
#         try:
#             with open(abi_path, 'r') as abi_file:
#                 abi_json = json.load(abi_file)
#                 contract_abi = abi_json['abi']
#         except (FileNotFoundError, json.JSONDecodeError) as e:
#             print(f"Error loading ABI from {filename}: {e}. Skipping this file.")
#             continue
#         except KeyError:
#             print(f"'abi' key not found in {filename}. Skipping this file.")
#             continue
        
#         # Instantiate the contract with the common address and loaded ABI
#         try:
#             contract = w3.eth.contract(address=common_contract_address, abi=contract_abi)
#             contract_list.append(contract)
#             print(f"Loaded contract from {filename} at address {common_contract_address}.")
#         except Exception as e:
#             print(f"Error creating contract instance from {filename}: {e}. Skipping this file.")


def get_contract_address(sender_address, nonce):

    # Compute the contract address
    sender_bytes = Web3.to_bytes(hexstr=sender_address)
    nonce_bytes = rlp.encode(nonce)
    contract_address = Web3.keccak(rlp.encode([sender_bytes, nonce_bytes]))[12:]

    checksum_address = to_checksum_address(Web3.to_hex(contract_address))
    return checksum_address


def print_contract_functions_with_selectors(contract):
    # explore all the available functions
    for item in contract.abi:
        if item['type'] == 'function':
            function_signature = f"{item['name']}({','.join([input['type'] for input in item['inputs']])})"
            selector = function_signature_to_4byte_selector(function_signature).hex()
            inputs = ', '.join([f"{input['type']} {input['name']}" for input in item['inputs']])
            print(f"0x{selector}: {item['name']}({inputs})")


def decode_transaction_input(tx_hash):
    tx = w3.eth.get_transaction(tx_hash)
    input_data = tx['input']

    for contract in contract_list:
        try:
            decoded_input = contract.decode_function_input(input_data)
            # see what functions are available through the contract
            # print_contract_functions_with_selectors(contract)
            # print(contract.functions.getReserves().call())
            return decoded_input
        except Exception as e:
            # print(str(e))
            continue  # Move to the next contract if decoding fails

    # If all contracts fail to decode, return the contract address
    contract_add = get_contract_address(tx['from'], tx['nonce'])
    return f"Unable to decode. Contract address: {contract_add}"



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


def send_signed_transaction(private_key, to_address, value, boost=0):
    # Initialize Web3 instance again because apparently it resets after 500 calls
    # and I am planning on using this to spam hehe
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    sender_account = w3.eth.account.from_key(private_key)

    w3.middleware_onion.add(construct_sign_and_send_raw_middleware(sender_account))

    # print(f"gas price is {w3.eth.gas_price}, of type {type(w3.eth.gas_price)}")
    transaction = {
        "from": sender_account.address,
        "value": hex(value),
        "to": to_address,
        "data": "0xabcd",
        "gasPrice": w3.eth.gas_price + boost
    }

    estimated_gas = w3.eth.estimate_gas(transaction)
   
    # print(f"gas price is {transaction['gasPrice']} {w3.eth.gas_price}, but estimated is {estimated_gas}")
    transaction["gas"] = estimated_gas + boost

    tx_hash = w3.eth.send_transaction(transaction)

    tx = w3.eth.get_transaction(tx_hash)
    # print(tx)
    return tx_hash.hex()
    
    

def get_block(block_number):
    # gets the block number queried
    # forms a response string which is returned, None if the block is an invalid block
    block_number = hex(block_number)
    block_response = send_rpc_request("eth_getBlockByNumber", [block_number, True])
    response_string = ""
    # print(block_response)
    if block_response.get("result") == None:
        # print("Block doesn't exist")
        return None
    elif 'result' in block_response:
        transactions = block_response['result']['transactions']
        # print(block_response)
        response_string += f"Transactions in block {block_number}:\n"
        for tx in transactions:
            response_string += f"Transaction Hash: {tx['hash']}\n"
            response_string += f"Index: {int(tx['transactionIndex'], 16)}, Nonce: {int(tx['nonce'], 16)}\n"
            response_string += f"From: {tx['from']}\n"
            response_string += f"To: {tx['to']}\n"
            if int(tx['value'], 16) == 0:
                response_string += f"{decode_transaction_input(tx['hash'])}\n"
            else:
                response_string += f"Value: {int(tx['value'], 16)} wei\n"
            response_string += f"Gasprice: {int(tx['gasPrice'], 16)} wei\n"
            response_string += "-----------------------------\n"

        # to avoid trying to regex empty response
        hex_pattern_block = r"block 0x([0-9a-fA-F]+):"

        match = re.search(hex_pattern_block, response_string)
        if match:
            hex_block = match.group(1)
            decimal = int(hex_block, 16)
            response_string = re.sub(hex_pattern_block, f'block {decimal}:', response_string)
        

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
                block_number = int(input(f"Block number (latest is {w3.eth.block_number}): "))
                response = get_block(block_number)
                print(response)
                
        except Exception as e:
            print(e)



















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





    # hex_pattern_value = r"Value: 0x([0-9a-fA-F]+) wei"
        # match = re.search(hex_pattern_value, response_string)
        # if match:
        #     hex_value = match.group(1)
        #     decimal = int(hex_value, 16)
        #     response_string = re.sub(hex_pattern_value, f'Value: {decimal} wei', response_string)


    # # Function signature
    # function_signature = "Mint(address,uint256,uint256)"

    # # Generate the function selector (first 4 bytes of Keccak-256 hash)
    # function_selector = Web3.keccak(text=function_signature)[:4].hex()

    # print(function_selector)