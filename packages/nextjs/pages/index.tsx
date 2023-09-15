import Home from "../components/polls/Home";
import { NextPage } from "next";
import { useAccount } from "wagmi";

const index: NextPage = () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isConnected } = useAccount();
  return (
    <div className="">
      {isConnected && <Home />}
      {!isConnected && <div className="m-2 flex justify-center text-primary">Connect your wallet to see polls</div>}
    </div>
  );
};

export default index;
