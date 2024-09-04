from utility import rpc_url
from web3 import Web3
import json

def decode_transaction_input(tx_hash):

    tx = w3.eth.get_transaction(tx_hash)
    input_data = tx['input']
    try:
        decoded_input = contract.decode_function_input(input_data)
    except:
        pass
    return decoded_input

w3 = Web3(Web3.HTTPProvider(rpc_url))
# Load the contract ABI
with open('UniSwapPair.json', 'r') as abi_file:
    contract_abi = json.load(abi_file)['abi']


contract_address = '0xd676AF79742bCAeb4a71CF62b85d5ba2D1deaf86'
contract = w3.eth.contract(address=contract_address, abi=contract_abi)

print(contract)
print(type(contract))
tx_hash = '0xa007dfa41e1eb3654cb677daa33e28fad778bacfc2bf0c0a8c034814a1fad1fc'
decoded_data = decode_transaction_input(tx_hash)
print(decoded_data)