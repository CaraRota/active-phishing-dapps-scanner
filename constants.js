export const DEFAULT_TARGET_SITES = 10;
export const DEFAULT_CONCURRENCY = 25;

export const SCORE_THRESHOLD = 8;
export const MIN_HTML_LENGTH = 500;

export const REQUEST_TIMEOUT = 8000;
export const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36";
export const ACCEPT_LANGUAGE = "en-US,en;q=0.9";
export const ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

export const METAMASK_URL =
    "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json";
export const OPENPHISH_URL = "https://openphish.com/feed.txt";

export const SUSPENSION_KEYWORDS = [
    "account suspended",
    "this site has been suspended",
    "hosting expired",
    "this domain has expired",
    "website is currently unavailable",
    "domain not found",
    "site is parked",
    "domain for sale",
    "parked domain",
    "domain seized",
    "domain suspended",
    "account has been suspended",
    "bandwidth limit exceeded",
];

export const CRYPTO_SIGNALS = [
    // Active wallet connection API calls — confirms a real dapp connection attempt
    { term: "eth_requestaccounts", weight: 6 },
    { term: "window.ethereum", weight: 4 },
    { term: "walletconnect", weight: 4 },
    { term: "web3modal", weight: 2 },
    { term: "rainbowkit", weight: 2 },
    { term: "wagmi", weight: 2 },
    { term: "connectkit", weight: 2 },
    // UI phishing
    { term: "connect wallet", weight: 5 },
    { term: "connect to dapp", weight: 5 },
    { term: "metamask", weight: 1 },
    { term: "wallet", weight: 1 },
    { term: "web3", weight: 1 },
    { term: "ethereum", weight: 1 },
];
