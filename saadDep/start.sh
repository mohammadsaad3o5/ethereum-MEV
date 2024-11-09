#!/bin/bash

# (i) Change directory
cd /home/ubuntu/ethereum-MEV/saadDep
rm -r /home/ubuntu/ethereum-MEV/saadDep/ignition/deployments

# (ii) Run hardhat ignition deployment with a "yes" response
yes | npx hardhat ignition deploy ignition/modules/LiquidityDeployment.js --network local

# (iii) Run the LiquidityEtherscan script
npx hardhat run scripts/LiquidityEtherscan.js

# Run (iv), (v), and (vi) in new terminal windows
# (iv) Run Flood.js in a new terminal
gnome-terminal -- bash -c "cd /home/ubuntu/ethereum-MEV/saadDep && npx hardhat run scripts/Flood.js; exec bash"

# (v) Run SandwichAttack.js in a new terminal
gnome-terminal -- bash -c "cd /home/ubuntu/ethereum-MEV/saadDep && npx hardhat run scripts/SandwichAttack.js; exec bash"

# (vi) Change directory and run txpool.py in a new terminal
gnome-terminal -- bash -c "cd /home/ubuntu/ethereum-MEV && python3 txpool.py; exec bash"

