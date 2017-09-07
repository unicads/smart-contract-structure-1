var Brickblock = artifacts.require('Brickblock')
require('chai').should()

async function brickblock() {
  return await Brickblock.new()
}

contract('Brickblock', accounts => {
  it('should deploy the contract', async () => {
    var bb = await brickblock()
    bb.contract.owner().should.eql(accounts[0])
  })

  it('should list brokers', async () => {
    var bb = await brickblock()
    await bb.addBroker.sendTransaction(accounts[1])
    var list = await bb.listBrokers.call()
    list.should.eql([accounts[1]])
  })

  it('should register broker', async () => {
    var bb = await brickblock()
    await bb.addBroker.sendTransaction(accounts[1], { from: accounts[0] })
    var list = await bb.listBrokers.call()
    list.should.eql([accounts[1]])
  })

  it('should only allow broker registration from owner address', async () => {
    var bb = await brickblock()
    return bb.addBroker
      .sendTransaction(accounts[1], { from: accounts[1] })
      .then(() => assert(false, 'Expected to throw'))
      .catch(e => e.should.match(/invalid opcode/))
  })
})
