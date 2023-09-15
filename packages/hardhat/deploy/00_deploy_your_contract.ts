import { utils, Provider, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

const deployerPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY ?? "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider("https://testnet.era.zksync.dev");
  // const provider = new Provider("http://host.docker.internal:3050");

  const wallet = new Wallet(deployerPrivateKey, provider);

  const deployer = new Deployer(hre, wallet);

  // // Deploying the ERC20 token
  const Polls = await deployer.loadArtifact("Polls");
  const polls = await deployer.deploy(Polls, []);
  console.log(`polls deployed at => ${polls.address}`);

  console.log(`Done!`);
}
