require('@nomicfoundation/hardhat-ignition');
require('@nomiclabs/hardhat-ethers');
require("@nomicfoundation/hardhat-toolbox");

// Ensure your configuration variables are set before executing the script
const { vars } = require("hardhat/config");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    saad: {
      url: 'http:/\/localhost:32783',
      accounts: ['0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23']
    }
  }
};
