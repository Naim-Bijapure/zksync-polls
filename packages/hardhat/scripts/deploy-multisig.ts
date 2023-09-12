import { utils, Provider, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

function getMultisigWallet(hre: HardhatRuntimeEnvironment, wallet: Wallet, address: string) {
  const artifact = hre.artifacts.readArtifactSync("MultiSigWallet");
  return new ethers.Contract(address, artifact.abi, wallet);
}

export default async function (hre: HardhatRuntimeEnvironment) {
  // const provider = new Provider("https://testnet.era.zksync.dev");
  const provider = new Provider("http://host.docker.internal:3050");

  // The wallet that will deploy the token and the paymaster
  // It is assumed that this wallet already has sufficient funds on zkSync
  const wallet = new Wallet("0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110", provider);
  const walletRandom = Wallet.createRandom();

  // The wallet that will receive ERC20 tokens
  const randomeWallet = Wallet.createRandom();
  // const emptyWallet = new Wallet("0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3", provider);
  const emptyWallet = new Wallet(randomeWallet.privateKey, provider);

  //     console.log(`Empty wallet's address: ${emptyWallet.address}`);
  //     console.log(`Empty wallet's private key: ${emptyWallet.privateKey}`);

  const deployer = new Deployer(hre, wallet);

  // Deploying the ERC20 token
  const MultiSigFactory = await deployer.loadArtifact("MultiSigFactory");
  const multiSigFactory = await deployer.deploy(MultiSigFactory, []);
  console.log(`multiSigFactory address: ${multiSigFactory.address}`);
  const computedAddress1 = await multiSigFactory.computedAddress("N");
  console.log(`n-🔴 => computedAddress1:`, computedAddress1);

  const multisigWalletRcpt = await multiSigFactory.create2([emptyWallet.address], 1, "N");
  const multisigWalletTx = await multisigWalletRcpt.wait();
  //     console.log(`n-🔴 => multisigWalletTx:`, multisigWalletTx);

  const numberOfMultisig = await multiSigFactory.numberOfMultiSigs();
  console.log(`n-🔴 => numberOfMultisig:`, numberOfMultisig.toString());

  const MultisigWallet = await multiSigFactory.getMultiSig(0);
  console.log(`n-🔴 => multisigWallet:multiSigAddress`, MultisigWallet.multiSigAddress);
  console.log(`n-🔴 => multisigWallet:signaturesRequired`, MultisigWallet.signaturesRequired.toString());

  const multisigWallet = getMultisigWallet(hre, emptyWallet, MultisigWallet.multiSigAddress);
  //     console.log(`n-🔴 => multisigWallet:`, multisigWallet);

  let owners = await multisigWallet.numberOfOwners();
  console.log(`n-🔴 => owners:`, owners.toString());

  let nonce = await multisigWallet?.nonce();
  console.log(`n-🔴 => nonce:before`, nonce.toString());

  const callData = "0x";
  // const callData = multisigWallet?.interface?.encodeFunctionData("addSigner", [wallet.address, 1]);
  //     console.log(`n-🔴 => callData:`, callData);
  const executeTo = wallet.address;
  const amount = ethers.utils.parseEther("" + parseFloat("5").toFixed(12));

  const newHash = await multisigWallet?.getTransactionHash(nonce, executeTo, amount, callData);
  const signature = await emptyWallet?.signMessage(ethers.utils.arrayify(newHash));
  const recover = await multisigWallet?.recover(newHash, signature);
  const isOwner = await multisigWallet?.isOwner(recover);
  console.log(`n-🔴 => isOwner:`, isOwner);

  console.log(`n-🔴 => multisigWallet.address:`, multisigWallet.address);
  let multisigBalance = await provider.getBalance(multisigWallet.address);
  console.log(`n-🔴 => multisigBalance: before`, (await multisigBalance).toString());

  const sendRcpt = await wallet.sendTransaction({
    to: multisigWallet.address,
    value: ethers.utils.parseEther("10"),
  });
  const sendTx = await sendRcpt?.wait();

  const paymasterParams = utils.getPaymasterParams(multisigWallet.address, {
    type: "General",
    // token: utils.ETH_ADDRESS,
    // set minimalAllowance as we defined in the paymaster contract
    // minimalAllowance: ethers.BigNumber.from(1),
    // empty bytes as testnet paymaster does not use innerInput
    innerInput: new Uint8Array(),
  });

  const gasPrice = await provider.getGasPrice();
  const gasLimit = await multisigWallet.estimateGas.executeTransaction(executeTo, amount, callData, [signature], {
    customData: {
      paymasterParams: paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  });

  const fee = gasPrice.mul(gasLimit.toString());
  console.log("Transaction fee estimation is :>> ", ethers.utils.formatEther(fee.toString()));

  const executeFuncTx = await multisigWallet?.executeTransaction(executeTo, amount, callData, [signature], {
    gasLimit: gasLimit,

    customData: {
      paymasterParams: paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  });
  const executeFuncRcpt = await executeFuncTx.wait();
  // console.log(`n-🔴 => executeFuncRcpt:`, executeFuncRcpt);

  owners = await multisigWallet.numberOfOwners();
  console.log(`n-🔴 => owners:`, owners.toString());

  multisigBalance = await provider.getBalance(multisigWallet.address);
  console.log(`n-🔴 => multisigBalance: after`, ethers.utils.formatEther(multisigBalance.toString()));

  const emptyWalletBalance = await provider.getBalance(emptyWallet.address);
  console.log(`n-🔴 => emptyWalletBalance:`, emptyWalletBalance.toString());

  nonce = await multisigWallet?.nonce();
  console.log(`n-🔴 => nonce:after`, nonce.toString());

  console.log(`Done!`);
}
