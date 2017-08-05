pragma solidity ^0.4.8;

import "zeppelin-solidity/contracts/token/StandardToken.sol";

/* Proof-of-Asset contract representing a token backed by a foreign asset.
 * TODO: This does not take into account multiple dividend payouts yet.
 */
contract POAToken is StandardToken {

  /* Event emitted when a state change occurs.
   */
  event Stage(Stages stage);

  /* Event emitted when tokens are bought
   */
  event Buy(address buyer, uint256 amount);

  /* Event emitted when tokens are sold
   */
  event Sell(address seller, uint256 amount);

  // The owner of this contract
  address public owner;

  // The name of this PoA Token
  string public name;

  // The symbol of this PoA Token
  string public symbol;

  // The broker managing this contract
  address public broker;

  // The custodian holding the assets for this contract
  address public custodian;

  // The time when the contract was created
  uint public creationTime;

  // The time available to fund the contract
  uint public timeout;

  // An account carrying a +balance+ and +claimedPayout+ value.
  struct Account {
    uint256 balance;
    uint256 claimedPayout;
  }

  // Mapping of Account per address
  mapping(address => Account) accounts;
  
  mapping(address => uint256) unliquidated_balances;
  mapping(address => uint256) unclaimed_balances;

  uint256[] payouts;
  mapping(address => uint256[]) claimed_payouts;
  
  enum Stages {
    Funding,
    Pending,
    Failed,
    Active
  }

  Stages public stage = Stages.Funding;

  /* Ensure current stage is +_stage+
   */
  modifier atStage(Stages _stage) {
    require(stage == _stage);
    _;
  }

  /* Enter given stage +_stage+
   */
  function enterStage(Stages _stage) {
    stage = _stage;
    Stage(_stage);
  }

  /* Ensure funding timeout hasn't expired
   */
  modifier checkTimeout() {
    if (stage == Stages.Funding &&
        now >= creationTime + timeout)
      enterStage(Stages.Failed);
    _;
  }

  /* Create a new POAToken contract.
   */
  function POAToken(string _name, string _symbol, address _broker, address _custodian,
                    uint _timeout, uint256 _supply) {
    owner = msg.sender;
    name = _name;
    symbol = _symbol;
    broker = _broker;
    custodian = _custodian;
    timeout = _timeout;
    creationTime = now;
    totalSupply = _supply;
    accounts[owner].balance = _supply;
  }

  /* Buy PoA tokens from the contract.
   * Called by any investor during the +Funding+ stage.
   */
  function buy() payable
    checkTimeout atStage(Stages.Funding)
  {
    require(accounts[owner].balance >= msg.value);
    require(accounts[msg.sender].balance + msg.value > accounts[msg.sender].balance);
    accounts[owner].balance -= msg.value;
    accounts[msg.sender].balance += msg.value;
    Buy(msg.sender, msg.value);

    if (accounts[owner].balance == 0)
      enterStage(Stages.Pending);
  }

  /* Activate the PoA contract, providing a valid proof-of-assets.
   * Called by the broker or custodian after assets have been received into the DTF account.
   * This verifies that the provided signature matches the expected symbol/amount and
   * was made with the custodians private key.
   */
  function activate(uint8 v, bytes32 r, bytes32 s)
    checkTimeout atStage(Stages.Pending)
  {
    bytes32 hash = sha3(symbol, bytes32(totalSupply));
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 prefixedHash = sha3(prefix, hash);

    address sigaddr = ecrecover(prefixedHash, v, r, s);

    if(sigaddr == custodian) {
      broker.transfer(this.balance);
      enterStage(Stages.Active);
    }
  }

  /* Reclaim funds after failed funding run.
   * Called by any investor during the `Failed` stage.
   */
  function reclaim()
    checkTimeout atStage(Stages.Failed)
  {
    uint256 balance = accounts[msg.sender].balance;
    accounts[msg.sender].balance = 0;
    msg.sender.transfer(balance);
  }

  /* Sell PoA tokens back to the contract.
   * Called by any investor during the `Active` stage.
   * This will subtract the given +amount+ from the users
   * token balance and saves it as unliquidated balance.
   */
  function sell(uint256 amount)
    atStage(Stages.Active)
  {
    require(accounts[msg.sender].balance >= amount);
    accounts[msg.sender].balance -= amount;
    unliquidated_balances[msg.sender] += amount;
    Sell(msg.sender, amount);
  }

  /* Provide funds from liquidated assets.
   * Called by the broker after liquidating assets.
   * This checks if the user has unliquidated balances
   * and transfers the value to the user.
   */
  function liquidated(address account) payable
    atStage(Stages.Active)
  {
    require(msg.sender == broker);
    require(unliquidated_balances[account] >= msg.value);
    unliquidated_balances[account] -= msg.value;
    account.transfer(msg.value);
  }

  /* Provide funds from a dividend payout.
   * Called by the broker after the asset yields dividends.
   * This will simply add the received value to the `payouts` array.
   */
  function payout() payable
    atStage(Stages.Active)
  {
    require(msg.value > 0);
    payouts.push(msg.value);
  }

  /* Claim dividend payout.
   * Called by any investor after dividends have been received.
   * This will calculate the payout, subtract any already claimed payouts,
   * update the claimed payouts for the given account, and send the payout.
   */
  function claim(uint256 i)
    atStage(Stages.Active)
  {
    uint256 payout = payouts[i] * accounts[msg.sender].balance / totalSupply;
    payout = payout - accounts[msg.sender].claimedPayout;
    require(payout > 0);
    accounts[msg.sender].claimedPayout += payout;
    msg.sender.transfer(payout);
  }

  /* Transfer +_value+ from sender to account +_to+.
   */
  function transfer(address _to, uint256 _value) returns (bool) {
    accounts[msg.sender].balance = accounts[msg.sender].balance.sub(_value);
    uint256 payout_sender = payouts[0] * accounts[msg.sender].balance.sub(_value) / totalSupply;
    accounts[msg.sender].claimedPayout = accounts[msg.sender].claimedPayout.sub(payout_sender);

    accounts[_to].balance = accounts[_to].balance.add(_value);
    uint256 payout_receiver = payouts[0] * accounts[_to].balance.add(_value) / totalSupply;
    accounts[_to].claimedPayout = accounts[_to].claimedPayout.add(payout_receiver);
    Transfer(msg.sender, _to, _value);
    return true;
  }

  /* Get balance of given account +_owner+.
   */
  function balanceOf(address _owner) constant returns (uint256 balance) {
    return accounts[_owner].balance;
  }

}
