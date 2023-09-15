import { useEffect } from "react";
import { useRouter } from "next/router";
import SafeApps from "~~/components/multisig/SafeApps";
import { useAppStore } from "~~/services/store/store";

// const appUrl = "http://localhost:3001";

// Persistent data array (typically fetched from the server)
// const resData = [
//   { id: 0, text: "Answer 1", votes: 0 },
//   { id: 1, text: "Answer 2", votes: 0 },
//   { id: 2, text: "Answer 3", votes: 0 },
// ];

const resData = [
  { id: 0, text: "YES", votes: 3 },
  { id: 1, text: "NO", votes: 10 },
];

const themeData = {
  textColor: "#19181f",
  mainColor: "#00B87B",
  backgroundColor: "white",
  // alignment: "center",
  leftColor: "#00B87B",
  rightColor: "#FF2E00",
};

// Object keys may vary on the poll type (see the 'Theme options' table below)
const customTheme = {
  textColor: "black",
  mainColor: "#00B87B",
  backgroundColor: "rgb(255,255,255)",
  // alignment: "center",
};

function vote(item: Result, results: Result[]) {
  // Here you probably want to manage
  // and return the modified data to the server.
}

const SafeAppsPage = () => {
  // const router = useRouter();

  // const walletAddress = useAppStore(state => state.walletAddress);

  // useEffect(() => {
  //   if (!walletAddress) {
  //     router.push("/");
  //   }
  // }, [walletAddress]);

  return (
    <div className="w-full ">
      <div className="flex  justify-center w-1/2  ">
        {/* <SafeApps isWC={false} /> */}
        <progress className="progress w-50 mt-10 h-4" value="30" max="100"></progress>
        {/* <LeafPoll
          type="multiple"
          question="What you wanna ask?"
          results={resData}
          theme={customTheme}
          onVote={vote}
          isVoted={false}
        /> */}
      </div>
    </div>
  );
};

export default SafeAppsPage;
