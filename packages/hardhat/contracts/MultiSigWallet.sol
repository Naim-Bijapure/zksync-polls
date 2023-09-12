// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// never forget the OG simple sig wallet: https://github.com/christianlundkvist/simple-multisig/blob/master/contracts/SimpleMultiSig.sol

pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MultiSigFactory.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

//custom errors
error DUPLICATE_OR_UNORDERED_SIGNATURES();
error INVALID_OWNER();
error INVALID_SIGNER();
error INVALID_SIGNATURES_REQUIRED();
error INSUFFICIENT_VALID_SIGNATURES();
error NOT_ENOUGH_SIGNERS();
error NOT_OWNER();
error NOT_SELF();
error NOT_FACTORY();
error TX_FAILED();

contract MultiSigWallet is IPaymaster {
    using ECDSA for bytes32;
    MultiSigFactory private immutable multiSigFactory;
    uint256 public immutable chainId;
    uint256 public constant factoryVersion = 1; // <---- set the factory version for backword compatiblity for future contract updates

    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event ExecuteTransaction(
        address indexed owner,
        address payable to,
        uint256 value,
        bytes data,
        uint256 nonce,
        bytes32 hash,
        bytes result
    );
    event Owner(address indexed owner, bool added);
    event EthSplitEqual(
        address indexed sender,
        uint256 totalAmount,
        address[] recipients
    );

    mapping(address => bool) public isOwner;

    address[] public owners;

    uint256 public signaturesRequired;
    uint256 public nonce;
    string public name;

    uint256 constant PRICE_FOR_PAYING_FEES = 1;

    address public allowedToken;

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) {
            revert NOT_OWNER();
        }
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) {
            revert NOT_SELF();
        }
        _;
    }

    modifier onlyValidSignaturesRequired() {
        _;
        if (signaturesRequired == 0) {
            revert INVALID_SIGNATURES_REQUIRED();
        }
        if (owners.length < signaturesRequired) {
            revert NOT_ENOUGH_SIGNERS();
        }
    }
    modifier onlyFactory() {
        if (msg.sender != address(multiSigFactory)) {
            revert NOT_FACTORY();
        }
        _;
    }

    constructor(string memory _name, address _factory) payable {
        name = _name;
        multiSigFactory = MultiSigFactory(_factory);
        chainId = block.chainid;
    }

    function init(
        address[] calldata _owners,
        uint256 _signaturesRequired
    ) public payable onlyFactory onlyValidSignaturesRequired {
        signaturesRequired = _signaturesRequired;

        // get a local reference of the length to save gas
        uint256 ownerLength = _owners.length;
        for (uint256 i = 0; i < ownerLength; ) {
            address owner = _owners[i];
            if (owner == address(0) || isOwner[owner]) {
                revert INVALID_OWNER();
            }
            isOwner[owner] = true;
            owners.push(owner);

            emit Owner(owner, true);
            unchecked {
                ++i;
            }
        }
    }

    function addSigner(
        address newSigner,
        uint256 newSignaturesRequired
    ) public onlySelf onlyValidSignaturesRequired {
        if (newSigner == address(0) || isOwner[newSigner]) {
            revert INVALID_SIGNER();
        }

        isOwner[newSigner] = true;
        owners.push(newSigner);
        signaturesRequired = newSignaturesRequired;

        emit Owner(newSigner, true);
        multiSigFactory.emitOwners(
            address(this),
            owners,
            newSignaturesRequired
        );
    }

    function removeSigner(
        address oldSigner,
        uint256 newSignaturesRequired
    ) public onlySelf onlyValidSignaturesRequired {
        if (!isOwner[oldSigner]) {
            revert NOT_OWNER();
        }

        _removeOwner(oldSigner);
        signaturesRequired = newSignaturesRequired;

        emit Owner(oldSigner, false);
        multiSigFactory.emitOwners(
            address(this),
            owners,
            newSignaturesRequired
        );
    }

    function _removeOwner(address _oldSigner) private {
        isOwner[_oldSigner] = false;
        uint256 ownersLength = owners.length;
        address lastElement = owners[ownersLength - 1];
        // check if the last element of the array is the owner t be removed
        if (lastElement == _oldSigner) {
            owners.pop();
            return;
        } else {
            // if not then iterate through the array and swap the owner to be removed with the last element in the array
            for (uint256 i = ownersLength - 2; i >= 0; ) {
                if (owners[i] == _oldSigner) {
                    address temp = owners[i];
                    owners[i] = lastElement;
                    lastElement = temp;
                    owners.pop();
                    return;
                }
                unchecked {
                    --i;
                }
            }
        }
    }

    function updateSignaturesRequired(
        uint256 newSignaturesRequired
    ) public onlySelf onlyValidSignaturesRequired {
        signaturesRequired = newSignaturesRequired;
    }

    function executeBatch(
        address[] calldata to,
        uint256[] calldata value,
        bytes[] calldata data,
        bytes[][] calldata signatures
    ) public onlyOwner returns (bytes[] memory) {
        uint256 toLength = to.length;
        bytes[] memory results = new bytes[](toLength);
        for (uint256 i = 0; i < toLength; i++) {
            results[i] = executeTransaction(
                payable(to[i]),
                value[i],
                data[i],
                signatures[i]
            );
        }
        return results;
    }

    function executeTransaction(
        address payable to,
        uint256 value,
        bytes calldata data,
        bytes[] calldata signatures
    ) public onlyOwner returns (bytes memory) {
        uint256 _nonce = nonce;
        bytes32 _hash = getTransactionHash(_nonce, to, value, data);

        nonce = _nonce + 1;

        uint256 validSignatures;
        address duplicateGuard;
        // get a local reference of the length to save gas
        uint256 signatureLength = signatures.length;
        for (uint256 i = 0; i < signatureLength; ) {
            address recovered = recover(_hash, signatures[i]);
            if (recovered <= duplicateGuard) {
                revert DUPLICATE_OR_UNORDERED_SIGNATURES();
            }
            duplicateGuard = recovered;

            if (isOwner[recovered]) {
                validSignatures++;
            }
            unchecked {
                ++i;
            }
        }

        if (validSignatures < signaturesRequired) {
            revert INSUFFICIENT_VALID_SIGNATURES();
        }

        (bool success, bytes memory result) = to.call{value: value}(data);
        if (!success) {
            revert TX_FAILED();
        }

        emit ExecuteTransaction(
            msg.sender,
            to,
            value,
            data,
            _nonce,
            _hash,
            result
        );
        return result;
    }

    function getTransactionHash(
        uint256 _nonce,
        address to,
        uint256 value,
        bytes calldata data
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    address(this),
                    chainId,
                    _nonce,
                    to,
                    value,
                    data
                )
            );
    }

    function recover(
        bytes32 _hash,
        bytes calldata _signature
    ) public pure returns (address) {
        return _hash.toEthSignedMessageHash().recover(_signature);
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    function numberOfOwners() public view returns (uint256) {
        return owners.length;
    }

    function splitEqualETH(
        address payable[] calldata recipients
    ) public payable onlySelf onlyValidSignaturesRequired {
        uint256 totalAmount = msg.value;
        uint256 rLength = recipients.length;
        uint256 equalAmount = totalAmount / rLength;
        uint256 remainingAmount = totalAmount % rLength;

        require(msg.value >= rLength, "Min. 1 wei/recipient for splitting");
        require(rLength <= 25 && rLength >= 2, "Recipients: min. 2, max. 25");

        uint256 sentAmount = 0;
        for (uint256 i = 0; i < rLength; ++i) {
            require(recipients[i] != address(0), "Invalid recipient address");
            uint256 amountToSend = equalAmount;
            if (i == 0) {
                amountToSend = amountToSend + remainingAmount;
            }
            (bool success, ) = recipients[i].call{value: amountToSend}("");
            require(success, "Transfer failed");
            sentAmount = sentAmount + amountToSend;
        }

        emit EthSplitEqual(
            msg.sender,
            msg.value,
            _convertToAddresses(recipients)
        );
    }

    function _convertToAddresses(
        address payable[] memory recipients
    ) internal pure returns (address[] memory) {
        address[] memory _recipients = new address[](recipients.length);
        for (uint256 i = 0; i < recipients.length; ++i) {
            _recipients[i] = recipients[i];
        }
        return _recipients;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );

        if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            uint256 requiredETH = _transaction.gasLimit *
                _transaction.maxFeePerGas;

            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
                value: requiredETH
            }("");
            require(
                success,
                "Failed to transfer tx fee to the bootloader. Paymaster balance might not be enough."
            );
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
}
