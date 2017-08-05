var Brickblock = artifacts.require("Brickblock")
require("chai").should()

const defaults = {
  brokers: [ "0xb000751ad5a01af93267b52910e24793cd0c7b55" ]
}


function brickblock(cb) {
  return Brickblock.new().then(cb)
}

function brickblock_with_broker(cb) {
  return Brickblock.new().then(i => {
    i.addBroker.sendTransaction(defaults.brokers[0]).then(txid => cb(i))
  })
}

contract("Brickblock", accounts => {

  it("should deploy the contract", () => {
    return brickblock(i => {
      i.contract.owner().should.eql(accounts[0])
    })
  })

  it("should list brokers", () => {
    var bb
    return brickblock(i => {
      bb = i
      return i.addBroker.sendTransaction(accounts[1])
    }).then(r => {
      return bb.listBrokers.call()
    }).then(list => {
      list.should.eql([accounts[1]])
    })
  })

  it("should register broker", () => {
    var bb
    return brickblock(i => {
      bb = i
      return bb.addBroker.sendTransaction(accounts[1], {from: accounts[0]})
    }).then(r => {
      return bb.listBrokers.call()
    }).then(r => {
      r.should.eql([accounts[1]])
    })
  })

  it("should only allow broker registration from owner address", () => {
    return brickblock(i => {
      return i.addBroker.sendTransaction(accounts[1], {from: accounts[1]})
    }).then(r => assert(false, "Expected to throw"))
      .catch(e => {
        e.toString().indexOf("invalid opcode").should.not.eql(-1)
      })
  })

  
})
