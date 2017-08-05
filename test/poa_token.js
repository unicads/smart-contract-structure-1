var POAToken = artifacts.require("POAToken")
require("chai").should()

var tdfw = function(bn) { return web3.toDecimal(web3.fromWei(bn, "ether")) };

const defaults = {
  name: "Test Token",
  symbol: "TST",
  owner: 0,
  broker: 1,
  user: 2, 
  custodian: 3, // account index of the custodian
  timeout: 10,
  totalSupply: 10,
}

const stages = {
  funding: 0,
  pending: 1,
  failed: 2,
  active: 3
}

function token(accounts, cb) {
  return POAToken.new(defaults.name, defaults.symbol,
                      accounts[defaults.broker],
                      accounts[defaults.custodian],
                      defaults.timeout,
                      web3.toWei(defaults.totalSupply))
                 .then(cb)
}

function token_pending(accounts, cb) {
  var t
  return token(accounts, i => { t = i
    return t.buy.sendTransaction({ from: accounts[defaults.user], value: web3.toWei(defaults.totalSupply) })
  }).then(r => cb(t))
}

function token_active(accounts, cb) {
  var t
  return token_pending(accounts, i => { t = i
    var amount = web3.toAscii(web3.toHex(web3.toWei(defaults.totalSupply)))
    while(amount.length < 32) amount = "\x00" + amount
    var hash = web3.sha3(web3.toHex(defaults.symbol + amount), { encoding: 'hex' })
    var signature = web3.eth.sign(accounts[defaults.custodian], hash)
    var r = signature.slice(0, 66)
    var s = '0x' + signature.slice(66, 130)
    var v = '0x' + signature.slice(130, 132)
    v = web3.toDecimal(v) + 27
    return t.activate(v, r, s)
  }).then(r => cb(t))
}

contract("POAToken", accounts => {
  
  it("should create token", () => {
    return token(accounts, t => {
      t.contract.name().should.eql(defaults.name)
      t.contract.symbol().should.eql(defaults.symbol)
      t.contract.broker().should.eql(accounts[defaults.broker])
      t.contract.custodian().should.eql(accounts[defaults.custodian])
      tdfw(t.contract.totalSupply()).should.eql(defaults.totalSupply)
      return t.stage()
    }).then(stage => {
      web3.toDecimal(stage).should.eql(stages.funding)
    })
  })
  
  it("should time out", () => {
    var token
    return POAToken.new(defaults.name, defaults.symbol,
                        accounts[defaults.broker],
                        accounts[defaults.custodian],
                        0,
                        web3.toWei(defaults.totalSupply)
    ).then(t => {
      token = t
      return t.buy.sendTransaction({ from: accounts[defaults.user], value: web3.toWei(5) })
    }).then(r => {
      assert(false, "Expected error")
    }).catch(e => {
      e.toString().indexOf("invalid opcode").should.not.eql(-1)
    })
    
  })
  
  it("should buy tokens", () => {
    return token(accounts, t => {
      return t.buy.sendTransaction({ from: accounts[defaults.user], value: web3.toWei(5) })
    }).then(r => {
      // TODO
    })
  })
  
  it("should not buy if owner balance is insufficient", () => {
    var t
    return token(accounts, i => { t = i
      return t.buy.sendTransaction({ from: accounts[defaults.user], value: web3.toWei(5) })
    }).then(r => {
      return t.buy.sendTransaction({ from: accounts[defaults.user], value: web3.toWei(6) })
    }).then(r => assert(false, "Expected to throw"))
      .catch(e => {
        e.toString().indexOf("invalid opcode").should.not.eql(-1)
      })
  })
  
  it("should change to funding stage when all tokens are sold", () => {
    var t
    return token(accounts, i => { t = i
      return t.buy.sendTransaction({ from: accounts[defaults.user], value: web3.toWei(10) })
    }).then(r => {
      return t.stage()
    }).then(stage => {
      web3.toDecimal(stage).should.eql(stages.pending)
    })
  })
  
  it("should activate contract with valid signature", () => {
    var t
    return token_pending(accounts, i => { t = i
      var amount = web3.toWei(defaults.totalSupply)
      amount = web3.toAscii(web3.toHex(amount))
      while(amount.length < 32) amount = "\x00" + amount
      var payload = web3.toHex(defaults.symbol + amount)
      var hash = web3.sha3(payload, { encoding: 'hex' })
      var signature = web3.eth.sign(accounts[defaults.custodian], hash)
      var r = signature.slice(0, 66)
      var s = '0x' + signature.slice(66, 130)
      var v = '0x' + signature.slice(130, 132)
      v = web3.toDecimal(v) + 27
      return t.activate(v, r, s)
    }).then(r => {
      web3.toDecimal(r.logs[0].args.stage).should.eql(stages.active)
      return web3.eth.getBalance(t.address)
    }).then(balance => {
      tdfw(balance).should == 0
    })
  })
  
  it("should reclaim funds", (done) => {
    var token
    POAToken.new(defaults.name, defaults.symbol,
                 accounts[defaults.broker],
                 accounts[defaults.custodian],
                 1,
                 web3.toWei(defaults.totalSupply)
    ).then(t => {
      token = t
      return t.buy.sendTransaction({ from: accounts[defaults.user], value: web3.toWei(5) })
    }).then(r => {
      setTimeout(() => {
        token.reclaim.sendTransaction({ from: accounts[defaults.user] }).then(r => {
          web3.toDecimal(token.contract.stage()).should.eql(stages.failed)
          return token.balanceOf(accounts[defaults.user])
        }).then(balance => {
          tdfw(balance).should.eql(0)
          return web3.eth.getBalance(accounts[defaults.user])
        }).then(balance => {
          // TODO log(tdfw(balance))
        }).then(done)
      }, 1000)
    })
  })
  
  it("should sell tokens", () => {
    var t, balance
    return token_active(accounts, i => { t = i
      return t.sell.sendTransaction(web3.toWei(5), { from: accounts[defaults.user] })
    }).then(() => {
      return t.balanceOf(accounts[defaults.user])
    }).then(balance => {
      tdfw(balance).should.eql(5)
      return web3.eth.getBalance(accounts[defaults.user])
    }).then(b => {
      balance = b
      return t.liquidated.sendTransaction(accounts[defaults.user], { from: accounts[defaults.broker], value: web3.toWei(5) })
    }).then(r => {
      return web3.eth.getBalance(accounts[defaults.user])
    }).then(b => {
      // TODO b - balance ~ 5
    })
  })

  it("should claim liquidation payout", () => {
    var t, balance, balance2
    return token_active(accounts, i => { t = i
      return web3.eth.getBalance(accounts[defaults.user])
    }).then(b => {
      balance = b
      return t.sell.sendTransaction(web3.toWei(5), { from: accounts[defaults.user] })
    }).then(r => {
      return t.payout.sendTransaction(accounts[defaults.user], { from: accounts[defaults.broker], value: web3.toWei(1) })
    }).then(r => {
      return t.claim.sendTransaction(0, { from: accounts[defaults.user] })
    }).then(r => {
      return web3.eth.getBalance(accounts[defaults.user])
    }).then(b => {
      var diff = tdfw(b - balance)
      assert(diff > 0.4 && diff < 0.5)
      return t.transfer.sendTransaction(accounts[defaults.custodian], web3.toWei(5),
                                        { from: accounts[defaults.user] })
    }).then(r => {
      return web3.eth.getBalance(accounts[defaults.custodian])
    }).then(b => {
      balance2 = b
      return t.claim.sendTransaction(0, { from: accounts[defaults.custodian] })
    }).catch(e => {
      e.toString().indexOf("invalid opcode").should.not.eql(-1)
      return web3.eth.getBalance(accounts[defaults.custodian])
    }).then(b => {
      var diff = tdfw(b - balance2)
      diff.should.eql(0)
    })
  })

})
