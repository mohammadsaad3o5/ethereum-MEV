require("@nomicfoundation/hardhat-toolbox");
require('@nomicfoundation/hardhat-ignition')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.18", 
      },
      {
        version: "0.7.6",  
      },
      {
        version: "0.6.12",
      },
      {
        version: "0.5.16", 
      },
      {
        version: "0.5.12", 
      },
      {
        version: "0.6.6", 
      },
      {
        version: "0.4.18", 
      },
    ],
  },
  networks: {
    local: {
      url: 'http:/\/localhost:33598',
      accounts: ['0xeaba42282ad33c8ef2524f07277c03a776d98ae19f581990ce75becb7cfa1c23']
    }
  }
};
