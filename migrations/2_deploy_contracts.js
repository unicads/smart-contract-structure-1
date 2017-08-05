var Brickblock = artifacts.require("Brickblock");
var POAToken = artifacts.require("POAToken");

module.exports = function(deployer) {
  deployer.deploy(POAToken)
  deployer.link(POAToken, Brickblock)
  deployer.deploy(Brickblock)
};
