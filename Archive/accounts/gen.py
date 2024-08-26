from eth_keys import keys
import os

# Generate a random 32-byte private key
private_key_bytes = os.urandom(32)
private_key = keys.PrivateKey(private_key_bytes)

# Derive the public key from the private key
public_key = private_key.public_key

file = open("account.txt", 'w')
# Print the keys in hexadecimal format
print("Private Key (hex):", private_key.to_hex())
file.write("Private Key (hex): " + private_key.to_hex() + "\n")
print("Public Key (hex):", public_key.to_hex())
file.write("Public Key (hex): " + public_key.to_hex() + "\n")
print("Ethereum Address:", public_key.to_checksum_address())
file.write("Ethereum Address: " + public_key.to_checksum_address() + "\n")
file.close()


