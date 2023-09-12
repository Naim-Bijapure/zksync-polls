import { CustomConnector } from "./wagmi-burner/CustomConnector";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  braveWallet,
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { configureChains } from "wagmi";
import * as chains from "wagmi/chains";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { publicProvider } from "wagmi/providers/public";
import scaffoldConfig from "~~/scaffold.config";
import { burnerWalletConfig } from "~~/services/web3/wagmi-burner/burnerWalletConfig";
import { getTargetNetwork } from "~~/utils/scaffold-eth";

const burnerConfig = scaffoldConfig.burnerWallet;
const configuredNetwork = getTargetNetwork();

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
const enabledChains = [
  // configuredNetwork,
  {
    ...chains.zkSyncTestnet,
    // on local  zkSyncTestnet
    // id: 270,
    // rpcUrls: {
    //   default: {
    //     // http: ["http://host.docker.internal:3050"],
    //     http: ["http://192.168.1.105:3050"],
    //   },
    //   public: {
    //     // http: ["http://host.docker.internal:3050"],
    //     http: ["http://192.168.1.105:3050"],
    //   },
    // },
  },
  chains.mainnet,
  // chains.polygon,
  // chains.goerli,
  // chains.sepolia,
  // chains.gnosis,
  // chains.arbitrum,
  // chains.polygonMumbai,
  // chains.optimism,
  // chains.canto,
];

/**
 * Chains for the app
 */
export const appChains = configureChains(
  enabledChains,
  [
    jsonRpcProvider({
      rpc: chain => {
        if (chain.rpcUrls.alchemy?.http[0]) {
          return {
            http: `${chain.rpcUrls.alchemy.http[0]}/${scaffoldConfig.alchemyApiKey}`,
          };
        }
        return null;
      },
    }),
    publicProvider(),
  ],
  {
    stallTimeout: 3_000,
    // Sets pollingInterval if using chain's other than local hardhat chain
    ...(configuredNetwork.id !== chains.hardhat.id
      ? {
          pollingInterval: scaffoldConfig.pollingInterval,
        }
      : {}),
  },
);

const walletsOptions = { chains: appChains.chains, projectId: scaffoldConfig.walletConnectProjectId };
const wallets = [
  metaMaskWallet({ ...walletsOptions, shimDisconnect: true }),
  walletConnectWallet(walletsOptions),
  ledgerWallet(walletsOptions),
  braveWallet(walletsOptions),
  coinbaseWallet({ ...walletsOptions, appName: "scaffold-eth-2" }),
  rainbowWallet(walletsOptions),
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = connectorsForWallets([
  {
    groupName: "Supported Wallets",
    wallets: burnerConfig.enabled ? [...wallets, burnerWalletConfig({ chains: [appChains.chains[0]] })] : wallets,
  },
]);
