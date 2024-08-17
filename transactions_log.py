from utility import get_block
# import get_block function from main utility file
import re

end_reached = False
block_number = 1

while not end_reached:
    # Increment block number till end is reached
    # Don't print anything is block doesn't contain transactions
    hex_pattern_block = r"block 0x([0-9a-fA-F]+):"
    current_block = get_block(block_number)
    if current_block == None:
        end_reached = True
        break
    # to avoid trying to regex empty response
    match = re.search(hex_pattern_block, current_block)
    if match:
        hex_block = match.group(1)
        decimal = int(hex_block, 16)
        current_block = re.sub(hex_pattern_block, f'block {decimal}:', current_block)
    hex_pattern_value = r"Value: 0x([0-9a-fA-F]+) wei"
    match = re.search(hex_pattern_value, current_block)
    if match:
        hex_value = match.group(1)
        decimal = int(hex_value, 16)
        current_block = re.sub(hex_pattern_value, f'Value: {decimal} wei', current_block)
    # Only print if there are transactions in this block
    if "Transaction Hash:" in current_block:
        print(current_block)
        
    block_number += 1