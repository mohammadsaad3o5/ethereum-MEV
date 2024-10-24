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
rpc_url = "http://localhost:32888"

# 0x7ff1a4c1d57e5e784d327c4c7651e952350bc271f156afb3d00d20f5ef924856 - contract owner
# 0x3a91003acaf4c21b3953d94fa4a6db694fa69e5242b2e37be05dd82761058899 - normal user

# ./bin/run init -r http://172.16.0.10:8545 -k 0x7ff1a4c1d57e5e784d327c4c7651e952350bc271f156afb3d00d20f5ef924856 -u 0x3a91003acaf4c21b3953d94fa4a6db694fa69e5242b2e37be05dd82761058899 -s deployment.json

# ./bin/run spam -r http://172.16.0.10:8545 -k 0x7ff1a4c1d57e5e784d327c4c7651e952350bc271f156afb3d00d20f5ef924856 -u 0x3a91003acaf4c21b3953d94fa4a6db694fa69e5242b2e37be05dd82761058899 -l deployment.json 

# Initialize Web3 instance
w3 = Web3(Web3.HTTPProvider(rpc_url))

contract_list = []

# # Load the contract ABI
with open('jsons/Dai.json', 'r') as abi_file:
    dai_contract_abi = json.load(abi_file)['abi']
with open('jsons/AtomicSwap.json', 'r') as abi_file:
    atomicSwap_abi = json.load(abi_file)['abi']
with open('jsons/WETH9.json', 'r') as abi_file:
    weth_abi = json.load(abi_file)['abi']
with open('jsons/UniswapV2Pair.json', 'r') as abi_file:
    pair_contract_abi = json.load(abi_file)['abi']


# Load the contracts into a list
dai_contract_address = "0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0"
dai_contract = w3.eth.contract(address=dai_contract_address, abi=dai_contract_abi)
contract_list.append(dai_contract)
atomicSwap_contract_address = "0x4bF8D2E79E33cfd5a8348737CA91bE5F65Ea7dd9"
atomicSwap_contract = w3.eth.contract(address=atomicSwap_contract_address, abi=atomicSwap_abi)
contract_list.append(atomicSwap_contract)
weth_contract_address = "0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C"
weth_contract = w3.eth.contract(address=weth_contract_address, abi=weth_abi)
contract_list.append(weth_contract)
pair_contractA_address = "0x5B177bEC59B41E9B14BC83662BAC7d187212443e"
pair_contractA = w3.eth.contract(address=pair_contractA_address, abi=pair_contract_abi)
contract_list.append(pair_contractA)
pair_contractB_address = "0xD83BDeDDE3AdB58b335737bD0E8eb77E16695375"
pair_contractB = w3.eth.contract(address=pair_contractB_address, abi=pair_contract_abi)
contract_list.append(pair_contractB)




def get_contract_address(sender_address, nonce):
    """
    Computes the Ethereum contract address based on the sender's address and nonce.

    Args:
        sender_address (str): The hexadecimal address of the sender (e.g., '0xabc123...').
        nonce (int): The nonce of the sender's account.

    Returns:
        str: The checksummed contract address.
    """
    # Ensure the sender address is in bytes format
    sender_bytes = Web3.to_bytes(hexstr=sender_address)
    
    # RLP encode the list [sender, nonce] without pre-encoding nonce
    encoded = rlp.encode([sender_bytes, nonce])
    
    # Compute the Keccak-256 hash of the encoded data
    contract_address_bytes = Web3.keccak(encoded)[12:]
    
    # Convert to hexadecimal and apply checksum
    checksum_address = Web3.to_checksum_address(Web3.to_hex(contract_address_bytes))
    
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
    # print(tx)
    for contract in contract_list:
        try:
            decoded_input = contract.decode_function_input(input_data)
          
            # see what functions are available through the contract
            # print_contract_functions_with_selectors(contract)
            # print(contract.functions.arb().trasact(["0x8Ed7F8Eca5535258AD520E32Ff6B8330A187641C","0x120671CcDfEbC50Cfe7B7A62bd0593AA6E3F3cF0", "0x1212eE52Bc401cCA1BF752D7E13F78a4eb3EbBB3", "0x91BF7398aFc3d2691aA23799fdb9175EE2EB6105", "0x5B177bEC59B41E9B14BC83662BAC7d187212443e", "0xD83BDeDDE3AdB58b335737bD0E8eb77E16695375", 121]))
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
    
def get_transaction(tx_hash: str):
    """
    Retrieves and formats transaction details based on the provided transaction hash.

    :param tx_hash: The hash of the transaction to retrieve.
    :return: A formatted string with transaction details or None if invalid.
    """
    # Validate the transaction hash format
    if not re.fullmatch(r"0x[a-fA-F0-9]{64}", tx_hash):
        print("Invalid transaction hash format.")
        return None

    # Send RPC request to get transaction details
    tx_response = send_rpc_request("eth_getTransactionReceipt", [tx_hash])
    print("status: ", tx_response.get('result')['status'])

    tx_response = send_rpc_request("eth_getTransactionByHash", [tx_hash])

    # Check if the transaction exists
    if not tx_response.get("result"):
        print("Transaction does not exist.")
        return None
    
    # print(tx_response)

    tx = tx_response['result']
    response_string = ""

    try:
        # Format Transaction Hash
        response_string += f"Transaction Hash: {tx.get('hash')}\n"

        # Format Transaction Index and Nonce
        transaction_index = int(tx.get('transactionIndex', '0x0'), 16)
        nonce = int(tx.get('nonce', '0x0'), 16)
        response_string += f"Index: {transaction_index}, Nonce: {nonce}\n"

        # Format From and To Addresses
        response_string += f"From: {tx.get('from')}\n"
        to_address = tx.get('to') if tx.get('to') else "Contract Creation"
        response_string += f"To: {to_address}\n"

        # Format Value
        value = int(tx.get('value', '0x0'), 16)
        if value == 0:
            decoded_input = decode_transaction_input(tx_hash)
            response_string += f"Input Data: {decoded_input}\n"
        else:
            response_string += f"Value: {value} wei\n"

        # Format Gas Price
        gas_price = int(tx.get('gasPrice', '0x0'), 16)
        response_string += f"Gas Price: {gas_price} wei\n"

        # Fetch Transaction Receipt for Gas Used and Block Number
        receipt_response = send_rpc_request("eth_getTransactionReceipt", [tx_hash])
        if receipt_response.get("result"):
            receipt = receipt_response['result']
            gas_used = int(receipt.get('gasUsed', '0x0'), 16)
            block_number_hex = receipt.get('blockNumber', '0x0')
            block_number = int(block_number_hex, 16)
            response_string += f"Gas Used: {gas_used} units\n"
            response_string += f"Block Number: {block_number}\n"
        else:
            response_string += "Gas Used: N/A\n"
            response_string += "Block Number: N/A\n"

        # Separator
        response_string += "-----------------------------\n"

        # Optional: Replace block number in hex with decimal if present in the response
        # (Already handled above)

    except Exception as e:
        print(f"Error processing transaction data: {e}")
        return None

    return response_string


def get_block(block_number, count = False):
    # gets the block number queried
    # forms a response string which is returned, None if the block is an invalid block
    block_number = hex(block_number)
    block_response = send_rpc_request("eth_getBlockByNumber", [block_number, True])
    response_string = ""

    if count:
        tuple_return = True
    else:
        tuple_return = False

    if block_response.get("result") == None:
        # print("Block doesn't exist")
        return None
    elif 'result' in block_response:
        transactions = block_response['result']['transactions']
        # print(block_response)
        
        # Send RPC request to get transaction details
        response_string += f"Transactions in block {block_number}:\n"
        if count:
            count = 0
        for tx in transactions:
            # See if transaction passed
            tx_response = send_rpc_request("eth_getTransactionReceipt", [tx['hash']])
            status = tx_response.get('result')['status']
            
            response_string += f"Transaction Hash: {tx['hash']}\n"
            response_string += f"Index: {int(tx['transactionIndex'], 16)}, Nonce: {int(tx['nonce'], 16)}\n"
            response_string += f"From: {tx['from']}\n"
            response_string += f"To: {tx['to']}\n"
            if int(tx['value'], 16) == 0:
                response_string += f"{decode_transaction_input(tx['hash'])}\n"
            else:
                response_string += f"Value: {int(tx['value'], 16)} wei\n"
            response_string += f"Gasprice: {int(tx['gasPrice'], 16)} wei\n"
            response_string += f"Status: {status}\n"
            response_string += "-----------------------------\n"

            # Count number of transactions
            count += 1

        # to avoid trying to regex empty response
        hex_pattern_block = r"block 0x([0-9a-fA-F]+):"

        match = re.search(hex_pattern_block, response_string)
        if match:
            hex_block = match.group(1)
            decimal = int(hex_block, 16)
            response_string = re.sub(hex_pattern_block, f'block {decimal}:', response_string)
        
    if tuple_return:
        return(response_string, count)
    else:
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

def get_exchange_rate():
    # Get exchage rates for both pairs
    pair = []
    token0, token1, _ =  pair_contractA.functions.getReserves().call()
    exchangeRate = (token0/token1)*0.997
    pair.append(exchangeRate)
    token0, token1, _ =  pair_contractB.functions.getReserves().call()
    if token1 == 0:
        exchangeRate = 0
    else:
        exchangeRate = (token0/token1)*0.997

    pair.append(exchangeRate)

    return tuple(pair)


if __name__ == "__main__":
    while True:
        tx = 0
        # if run as main, keep asking what you want to do
        print("1: Send transaction (from address, to address, value = 200000 wei for now)")
        print("2: Get balance (address)")
        print("3: Get block details (number)")
        print("4: Get transaction details (hash)") 
        print("5: Get exchange rate on both pairs") 
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

            if request == '4':
                # New code for getting transaction details
                tx_hash = input("Enter Transaction Hash (0x...): ")
                transaction_details = get_transaction(tx_hash)
                if transaction_details:
                    print(transaction_details)
                else:
                    print("Failed to retrieve transaction details.")
                
            if request == '5':    
                pair = get_exchange_rate()
                print(f"In pairA, the exchange rate is {pair[0]}")
                print(f"In pairB, the exchange rate is {pair[1]}")


            if request == '6':    
                block = w3.eth.get_block('latest')
                gas_limit = block['gasLimit']
                print(f"Block Gas Limit: {gas_limit}")
                # Load the private key
                private_key = "0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23"

                w3 = Web3(Web3.HTTPProvider(rpc_url))
                sender_account = w3.eth.account.from_key(private_key)

                w3.middleware_onion.add(construct_sign_and_send_raw_middleware(sender_account))
                tx = w3.eth.contract(address=dai_contract_address, abi=dai_contract_abi).functions.approve("0xE25583099BA105D9ec0A67f5Ae86D90e50036425", 322).build_transaction({
                'chainId': 3151908,  
                'gasPrice':  w3.eth.gas_price, 
                'nonce': 4
                })
                # estimated_gas = w3.eth.estimate_gas(tx)
                # print("estimated gas is", estimated_gas)
                tx["gas"] = 30000000

                signed_txn = w3.eth.account.sign_transaction(tx, private_key=private_key)
                tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
                tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
                print(tx)

                
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

    # print_contract_functions_with_selectors(dai_contract)
    