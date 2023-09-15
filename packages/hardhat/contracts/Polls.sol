// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

contract Polls is IPaymaster {
  event Deposit(address indexed sender, uint256 amount, uint256 balance);
  event Voted(address indexed voter, uint256 pollId);
  event PollCreated(address indexed user, uint256 pollId);

  struct Poll {
    uint pollId;
    string content;
    string[] results;
    address[] voters;
  }

  struct User {
    address wallet;
    string name;
    uint[] userPolls;
  }
  mapping(uint => Poll) public polls; //stores and retrieve polls
  mapping(address => User) public users; // stores and retrieves users
  mapping(address => uint[]) public userPolls; // stores and retrieves user polls

  uint256 public nextPollId;

  constructor() payable {}

  // on create poll
  function createBinaryPoll(string calldata _content) external payable returns (bool) {
    require(bytes(_content).length > 0, "Content cannot be an empty string");

    User storage user = users[msg.sender];

    string[] memory results;
    address[] memory voters;
    Poll memory newPoll = Poll(nextPollId, _content, results, voters);
    polls[nextPollId] = newPoll;
    user.userPolls.push(nextPollId);

    userPolls[msg.sender].push(nextPollId);
    nextPollId++;
    emit PollCreated(msg.sender, nextPollId);
    return true;
  }

  // on vote
  function voteOnPoll(string calldata _vote, uint _pollId) external {
    Poll storage activePoll = polls[_pollId];
    require(activePoll.pollId == _pollId, "Poll does not exist");
    require(
      activePoll.voters.length == 0 || !contains(activePoll.voters, msg.sender),
      "User has already voted on this poll"
    );
    activePoll.voters.push(msg.sender);
    activePoll.results.push(_vote);
    emit Voted(msg.sender, _pollId);
  }

  //check if an element is in an array
  function contains(address[] storage array, address element) internal view returns (bool) {
    for (uint i = 0; i < array.length; i++) {
      if (array[i] == element) {
        return true;
      }
    }
    return false;
  }

  function getPollResults(uint _pollId) external view returns (Poll memory) {
    return polls[_pollId];
  }

  function getUserPolls(address user) external view returns (uint[] memory) {
    return userPolls[user];
  }

  // zk paymaster
  modifier onlyBootloader() {
    require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
    // Continue execution if called from the bootloader.
    _;
  }

  function validateAndPayForPaymasterTransaction(
    bytes32,
    bytes32,
    Transaction calldata _transaction
  ) external payable onlyBootloader returns (bytes4 magic, bytes memory context) {
    // By default we consider the transaction as accepted.
    magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
    require(_transaction.paymasterInput.length >= 4, "The standard paymaster input must be at least 4 bytes long");

    bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);

    if (paymasterInputSelector == IPaymasterFlow.general.selector) {
      uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

      (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: requiredETH}("");
      require(success, "Failed to transfer tx fee to the bootloader. Paymaster balance might not be enough.");
    } else {
      revert("Unsupported paymaster flow");
    }
  }

  function postTransaction(
    bytes calldata _context,
    Transaction calldata _transaction,
    bytes32,
    bytes32,
    ExecutionResult _txResult,
    uint256 _maxRefundedGas
  ) external payable override onlyBootloader {}

  receive() external payable {
    emit Deposit(msg.sender, msg.value, address(this).balance);
  }
}
