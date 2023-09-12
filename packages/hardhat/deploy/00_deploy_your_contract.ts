import { utils, Provider, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

const deployerPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY ?? "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";

export default async function (hre: HardhatRuntimeEnvironment) {
  // const provider = new Provider("https://testnet.era.zksync.dev");
  const provider = new Provider("http://host.docker.internal:3050");

  const wallet = new Wallet(deployerPrivateKey, provider);

  const deployer = new Deployer(hre, wallet);

  // const code = await provider.getCode("0xeD46De724A9F0EAbFdB5f601DDA11bfb9ab815c3");
  // console.log(`n-🔴 => checkContractDeployment => code:`, code);

  // // Deploying the ERC20 token
  const MultiSigFactory = await deployer.loadArtifact("MultiSigFactory");
  const multiSigFactory = await deployer.deploy(MultiSigFactory, []);
  console.log(`multiSigFactory deployed at => ${multiSigFactory.address}`);

  const multisigWalletRcpt = await multiSigFactory.create2([wallet.address], 1, "N");
  const multisigWalletTx = await multisigWalletRcpt.wait();

  const MultisigWallet = await multiSigFactory.getMultiSig(0);
  console.log(`multisigWallet deployed at =>`, MultisigWallet.multiSigAddress);

  console.log(`Done!`);
}
