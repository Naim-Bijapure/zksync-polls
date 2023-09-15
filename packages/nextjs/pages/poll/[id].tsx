import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import { useAccount, useSigner } from "wagmi";
import { Web3Provider, utils } from "zksync-web3";
import { useDeployedContractInfo, useScaffoldEventSubscriber } from "~~/hooks/scaffold-eth";

const Page = () => {
  const router = useRouter();
  const [pollsContract, setPollsContract] = useState<any>();
  const [pollData, setPollData] = useState<any>();

  const [isVoting, setOnVoting] = useState<any>({});

  const [votedPollId, setVotedPollId] = useState<string>("");
  const pollId = router.query.id;

  const { isConnected, address } = useAccount();
  const { data: signer } = useSigner();

  const { data: deployedFactoryInfo } = useDeployedContractInfo("Polls");

  useScaffoldEventSubscriber({
    contractName: "Polls",
    eventName: "Voted",
    listener(...args) {
      const votedPollId = [...args][1];
      console.log(`voted..!`);
      setVotedPollId(votedPollId.toString());
    },

    once: false,
  });

  const getPollDetails = async (pollId: string) => {
    const pollDetails: any = await pollsContract.getPollResults(pollId.toString());
    const pollData = {
      content: JSON.parse(pollDetails.content),
      pollId: pollDetails.pollId.toString(),
      voters: pollDetails.voters,
      results: pollDetails.results,
      isVoted: (pollDetails.voters as any[])?.includes(address),
      result: {},
    };

    if (pollData.isVoted) {
      const result: any = {};
      const totalVotes = pollData.results.length;
      const optionCounts: any = {};

      pollData.results.forEach((option: any) => {
        optionCounts[option] = (optionCounts[option] || 0) + 1;
      });

      for (const option in optionCounts) {
        result[option] = `${((optionCounts[option] / totalVotes) * 100).toFixed(0)}`;
      }
      pollData.result = result;
    }
    setPollData(pollData);
  };

  const onVote = async (pollId: string, selected: string) => {
    setOnVoting({ [pollId]: true });
    const paymasterParams = utils.getPaymasterParams(pollsContract.address, {
      type: "General",
      innerInput: new Uint8Array(),
    });

    const customData = {
      paymasterParams: paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    };

    const tx = await pollsContract.voteOnPoll(selected, pollId, { customData });
    const waitFinalize = await tx.waitFinalize();
  };

  const updateVotedPoll = async (pollId: string, address: string) => {
    pollId = pollId.toString();

    const pollDetails: any = await pollsContract.getPollResults(pollId.toString());

    const pollData = {
      content: JSON.parse(pollDetails.content),
      pollId: pollDetails.pollId.toString(),
      voters: pollDetails.voters,
      results: pollDetails.results,
      isVoted: (pollDetails.voters as any[])?.includes(address),
      result: {},
    };

    if (pollData.isVoted) {
      const result: any = {};
      const totalVotes = pollData.results.length;
      const optionCounts: any = {};

      pollData.results.forEach((option: any) => {
        optionCounts[option] = (optionCounts[option] || 0) + 1;
      });

      for (const option in optionCounts) {
        result[option] = `${((optionCounts[option] / totalVotes) * 100).toFixed(0)}`;
      }
      pollData.result = result;
    }

    setPollData(pollData);
    setOnVoting({ [pollId]: false });
  };

  useEffect(() => {
    if (votedPollId) {
      updateVotedPoll(votedPollId, address as string);
    }
  }, [votedPollId]);

  useEffect(() => {
    if (deployedFactoryInfo && signer && deployedFactoryInfo) {
      //@ts-ignore
      const providerZk = new Web3Provider(window.ethereum);
      const zkSigner = providerZk.getSigner();

      const pollsContract = new ethers.Contract(deployedFactoryInfo?.address, deployedFactoryInfo?.abi, zkSigner);
      setPollsContract(pollsContract);
    }
  }, [deployedFactoryInfo, signer]);

  useEffect(() => {
    if (pollId !== undefined && pollsContract) {
      getPollDetails(pollId as string);
    }
  }, [pollId, pollsContract]);

  //   useEffect(() => {
  //     if (!address) {
  //       router.push("/");
  //     }
  //   }, [address]);

  if (!isConnected) {
    return <div className="m-2 flex justify-center text-primary">Connect your wallet to see poll</div>;
  }

  return (
    <>
      <div className="flex justify-center m-5">
        <div className="card w-96 bg-base-100 shadow-xl m-2">
          <div className="card-body">
            <h2 className="card-title">{pollData?.content.title}</h2>

            {isVoting[pollId as any] && (
              <>
                <progress className="progress progress-warning m-2 h-2 w-56 "></progress>
              </>
            )}
            {/* options */}

            {pollData?.content.options &&
              (pollData?.content.options as any[]).map((option, index) => {
                return (
                  <div key={index}>
                    <button
                      disabled={pollData?.isVoted}
                      className="btn btn-sm  btn-secondary w-full"
                      onClick={() => {
                        onVote(pollId as string, option);
                      }}
                    >
                      {/* {option} {isVoted && result[option]} */}
                      {option}
                    </button>
                    {pollData?.isVoted && (
                      <div className="flex justify-start items-center">
                        <progress
                          className="progress progress-success m-2 h-2 w-56 "
                          value={`${pollData.isVoted ? pollData.result[option] : "0"}`}
                          max="100"
                        ></progress>
                        <span>{pollData.isVoted && pollData.result[option] ? pollData.result[option] : 0} %</span>
                      </div>
                    )}
                  </div>
                );
              })}
            <div className="text-gray-400 text-xs ml-2">{pollData?.voters.length} voted</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
