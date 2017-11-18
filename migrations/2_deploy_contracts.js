const Brickblock = artifacts.require('Brickblock')
const BrickblockToken = artifacts.require('./BrickblockToken.sol')
const POAToken = artifacts.require('POAToken')

module.exports = async function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(POAToken)
    await deployer.link(POAToken, Brickblock)
    await deployer.deploy(Brickblock)
    await deployer.deploy(BrickblockToken)
  })
}
