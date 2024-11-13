cd /home/ubuntu/ethereum-MEV/saadDep
rm -r /home/ubuntu/ethereum-MEV/saadDep/ignition/deployments
echo yes | npx hardhat ignition deploy ignition/modules/deploy1.js --network local
echo yes | npx hardhat ignition deploy ignition/modules/deploy2.js --network local
echo yes | npx hardhat ignition deploy ignition/modules/deploy3.js --network local
echo yes | npx hardhat ignition deploy ignition/modules/deploy4.js --network local
echo yes | npx hardhat ignition deploy ignition/modules/deploy5.js --network local
