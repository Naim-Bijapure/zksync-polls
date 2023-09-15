import { useEffect, useRef, useState } from "react";
import { EtherInput } from "../scaffold-eth";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import { useCopyToClipboard, useInterval } from "usehooks-ts";
import { useAccount, useSigner } from "wagmi";
import { Web3Provider, utils } from "zksync-web3";
import { PlusCircleIcon, ShareIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  useDeployedContractInfo,
  useScaffoldContractRead,
  useScaffoldContractWrite,
  useScaffoldEventSubscriber,
} from "~~/hooks/scaffold-eth";

const Home = () => {
  // useEffect(() => {}, []);
  const { isConnected, address } = useAccount();
  const { data: signer } = useSigner();
  let [polls, setPolls] = useState<any[]>([]);
  const isLoaded = useRef<any>();
  const [pollsContract, setPollsContract] = useState<any>();
  const [amount, setAmount] = useState<string>();
  const [pollTitle, setPollTitle] = useState<string>();
  const [newOption, setNewOption] = useState<string>();
  const [pollOptions, setPollOptions] = useState<string[]>([]);
  const [refreshPolls, setRefreshPolls] = useState<boolean>(false);
  const [refreshPollsCreated, setRefreshPollsCreatd] = useState<boolean>(false);
  const [votedPollId, setVotedPollId] = useState<string>("");
  const [isCreatePollModalOpen, setIsCreatePollModalOpen] = useState<boolean>(false);

  const [value, copy] = useCopyToClipboard();

  const [isVoting, setOnVoting] = useState<any>({});

  const { data: deployedFactoryInfo } = useDeployedContractInfo("Polls");

  const { data: createPoll, writeAsync } = useScaffoldContractWrite({
    contractName: "Polls",
    functionName: "createBinaryPoll",

    args: [JSON.stringify({ title: pollTitle, options: [...pollOptions] })],
    value: amount && !isNaN(+amount) ? `${Number(amount)}` : "0",
  });
  const { data: userPolls } = useScaffoldContractRead({
    contractName: "Polls",
    functionName: "getUserPolls",
    args: [address ? address : ethers.constants.AddressZero],
    watch: true,
  });

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

  // useScaffoldEventSubscriber({
  //   contractName: "Polls",
  //   eventName: "PollCreated",
  //   listener(...args) {
  // // // //     console.log(`n-🔴 => listener => ...args:`, ...args);
  //     // setRefreshPolls(!refreshPollsCreated);
  //     const pollId = [...args][1];
  //     setNewPollId(pollId.toString());
  //   },

  //   once: false,
  // });

  const loadPollDetails = async function (pollId: string) {
    // const userPolls: any = await pollsContract.getUserPolls(address);

    // for (const pollId of userPolls) {
    const pollDetails: any = await pollsContract.getPollResults(pollId.toString());

    polls.push({
      content: JSON.parse(pollDetails.content),
      pollId: pollDetails.pollId.toString(),
      voters: pollDetails.voters,
      results: pollDetails.results,
      isVoted: (pollDetails.voters as any[])?.includes(address),
    });

    polls.map((poll: any) => {
      if (poll.isVoted) {
        const result: any = {};
        const totalVotes = poll.results.length;
        const optionCounts: any = {};

        poll.results.forEach((option: any) => {
          optionCounts[option] = (optionCounts[option] || 0) + 1;
        });

        for (const option in optionCounts) {
          result[option] = `${((optionCounts[option] / totalVotes) * 100).toFixed(0)}`;
        }
        poll.result = result;
      }
    });

    polls.sort((dataA: any, dataB: any) => {
      const pollIdA = parseInt(dataA.pollId);
      const pollIdB = parseInt(dataB.pollId);
      return pollIdB - pollIdA;
    });

    setPolls(polls);
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

  const fetchPollsData = async () => {
    setPolls([]);
    const userPolls: any = await pollsContract.getUserPolls(address ? address : ethers.constants.AddressZero);
    for (const polId of userPolls) {
      // loadPollDetails(polId.toString());
    }
  };

  // useInterval(() => {
  //   fetchPollsData();

  const onCreatePoll = async () => {
    await writeAsync();
  };

  const checkRcpt = async (createPoll: any) => {
    const rcpt = await createPoll.wait();
    const nextPollId: any = await pollsContract.nextPollId();

    polls.push({
      content: { title: pollTitle, options: [...pollOptions] },
      pollId: +nextPollId.toString() - 1,
      voters: [],
      results: [],
      isVoted: false,
    });

    polls.sort((dataA: any, dataB: any) => {
      const pollIdA = parseInt(dataA.pollId);
      const pollIdB = parseInt(dataB.pollId);
      return pollIdB - pollIdA;
    });
    setPolls(polls);

    setIsCreatePollModalOpen(false);
  };

  const updateVotedPoll = async (pollId: string, address: string) => {
    pollId = pollId.toString();

    const pollDetails: any = await pollsContract.getPollResults(pollId.toString());

    polls = polls.map(item => {
      if (+item.pollId === +pollId) {
        item = {
          content: JSON.parse(pollDetails.content),
          pollId: pollDetails.pollId.toString(),
          voters: pollDetails.voters,
          results: pollDetails.results,
          isVoted: (pollDetails.voters as any[])?.includes(address),
        };
      }
      return item;
    });

    polls.map((poll: any) => {
      if (poll.isVoted) {
        const result: any = {};
        const totalVotes = poll.results.length;
        const optionCounts: any = {};

        poll.results.forEach((option: any) => {
          optionCounts[option] = (optionCounts[option] || 0) + 1;
        });

        for (const option in optionCounts) {
          result[option] = `${((optionCounts[option] / totalVotes) * 100).toFixed(0)}`;
        }
        poll.result = result;
      }
    });

    polls.sort((dataA: any, dataB: any) => {
      const pollIdA = parseInt(dataA.pollId);
      const pollIdB = parseInt(dataB.pollId);
      return pollIdB - pollIdA;
    });

    setPolls(polls);
    setOnVoting({ [pollId]: false });
  };

  const onShare = async (pollId: string) => {
    const walletUrl = `${window.location.origin}/poll/${pollId}`;
    copy(walletUrl);
    toast.success("poll url copied !");
  };

  useEffect(() => {
    if (votedPollId) {
      updateVotedPoll(votedPollId, address as string);
    }
  }, [votedPollId]);

  useEffect(() => {
    if (createPoll) {
      checkRcpt(createPoll);
    }
  }, [createPoll]);

  useEffect(() => {
    if (userPolls && !isLoaded.current && pollsContract) {
      for (const polId of userPolls) {
        loadPollDetails(polId.toString());
      }
      isLoaded.current = true;
    }
  }, [userPolls, pollsContract]);

  // useEffects
  useEffect(() => {
    if (deployedFactoryInfo && signer && deployedFactoryInfo) {
      //@ts-ignore
      const providerZk = new Web3Provider(window.ethereum);
      const zkSigner = providerZk.getSigner();

      const pollsContract = new ethers.Contract(deployedFactoryInfo?.address, deployedFactoryInfo?.abi, zkSigner);
      setPollsContract(pollsContract);
    }
  }, [deployedFactoryInfo, signer]);

  return (
    <div className="flex flex-col items-center ">
      {/* HEADER */}
      <div className="flex justify-center items-center text-center mt-10">
        <div className="font-bold text-primary uppercase m-1 ">Your polls</div>
        <label
          htmlFor="my_modal_6"
          className="btn btn-ghost btn-sm m-1"
          onClick={() => {
            setIsCreatePollModalOpen(true);
          }}
        >
          {/* Create Poll */}
          <PlusCircleIcon className="text text-primary-content" width={30} />
        </label>
      </div>

      {/* LOAD THE LIST OF ALL POLLS */}
      <div>
        {polls.map((item, index) => {
          const { content, pollId, isVoted, result, voters } = item;

          return (
            <div className="card w-96 bg-base-100 shadow-xl m-2" key={index}>
              <div className="card-body">
                <h2 className="card-title  flex justify-between">
                  {content?.title}

                  <ShareIcon width={19} className="cursor-pointer text-primary" onClick={() => onShare(pollId)} />
                </h2>

                {isVoting[pollId] && (
                  <>
                    <progress className="progress progress-warning m-2 h-2 w-56 "></progress>
                  </>
                )}
                {/* options */}

                {(content?.options as any[]).map((option, index) => {
                  return (
                    <div key={index}>
                      <button
                        disabled={isVoted}
                        className="btn btn-sm  btn-secondary w-full"
                        onClick={() => {
                          onVote(pollId, option);
                        }}
                      >
                        {/* {option} {isVoted && result[option]} */}
                        {option}
                      </button>
                      {isVoted && (
                        <div className="flex justify-start items-center">
                          <progress
                            className="progress progress-success m-2 h-2 w-56 "
                            value={`${isVoted ? result[option] : "0"}`}
                            max="100"
                          ></progress>
                          <span>{isVoted && result[option] ? result[option] : 0} %</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="text-gray-400 text-xs ml-2">{voters.length} voted</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* CREATE POLL MODAL */}
      <input type="checkbox" id="my_modal_6" className="modal-toggle" checked={isCreatePollModalOpen} />
      <div className="modal">
        <div className="modal-box">
          <label
            htmlFor="my_modal_6"
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={() => {
              setIsCreatePollModalOpen(false);
            }}
          >
            ✕
          </label>
          <h3 className="font-bold text-lg">Create a new poll</h3>
          <p className="py-4">
            <div className="m-2">
              <input
                value={pollTitle}
                onChange={e => {
                  setPollTitle(e.target.value);
                }}
                type="text"
                placeholder="Enter title"
                className="input input-bordered input-primary w-full"
              />
            </div>
            <div className="m-2 flex justify-between">
              <input
                value={newOption}
                onChange={e => {
                  setNewOption(e.target.value);
                }}
                type="text"
                placeholder="Add options"
                className="input input-bordered input-primary w-full"
              />
              <button
                className="btn btn-secondary"
                disabled={!newOption}
                onClick={() => {
                  setPollOptions([...new Set([...pollOptions, newOption])] as any);
                  setNewOption("");
                }}
              >
                +
              </button>
            </div>

            <div className="m-2">
              {pollOptions.map((item, index) => {
                return (
                  <div key={index} className="flex justify-between items-center">
                    <div className="ml-5">
                      {index}. {""}
                      {item}
                    </div>
                    <div className="mr-20">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setPollOptions([...pollOptions.filter(element => element != item)]);
                        }}
                      >
                        <TrashIcon width={19} className="text-error" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="m-2">
              <EtherInput
                value={amount as string}
                onChange={setAmount}
                placeholder="You need to add at least 0.01 eth"
              />
            </div>
          </p>
          <div className="modal-action">
            {/* <label htmlFor="my_modal_6"> */}
            <button
              className="btn"
              disabled={
                !pollTitle ||
                pollOptions.length <= 1 ||
                (amount && Number(amount) < 0.01) === true ||
                amount === undefined
              }
              onClick={async () => {
                // await writeAsync();
                // window.location.reload();
                onCreatePoll();
              }}
            >
              Submit
            </button>
            {/* </label> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
