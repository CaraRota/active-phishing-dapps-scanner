# active-phishing-dapps-scanner

Finds active crypto phishing dapps that have a wallet connection flow, for use as test targets when verifying that wallets properly block or warn about deceptive dapp connection attempts.

This is not a general phishing scanner. The goal is to quickly surface a small number of live sites that will actually prompt a wallet connection — so you can connect and observe whether the wallet triggers a warning.

## How it works

1. Fetches the [MetaMask eth-phishing-detect](https://github.com/MetaMask/eth-phishing-detect) blacklist and the OpenPhish feed in parallel
2. Shuffles and checks domains concurrently (25 at a time by default)
3. Scores each live site by wallet connection signals found in its HTML and inline scripts
4. Stops as soon as enough qualifying sites are found

Sources are defined in `sources.js`. Add or remove blocklist feeds there.

## Usage

Requires Node ≥ 18. No dependencies.

```bash
node index.js
```

### Environment variables

| Variable       | Default | Description                                           |
| -------------- | ------- | ----------------------------------------------------- |
| `TARGET_SITES` | `10`    | Stop after finding this many confirmed phishing dapps |
| `CONCURRENCY`  | `25`    | Simultaneous domain checks                            |

## Scoring

Only sites with a score ≥ 8 are reported. Signals are checked against the full HTML including inline scripts:

| Signal                                              | Weight  |
| --------------------------------------------------- | ------- |
| `eth_requestaccounts`                               | +6      |
| `window.ethereum` / `walletconnect`                 | +4 each |
| `web3modal` / `wagmi` / `rainbowkit` / `connectkit` | +2 each |
| `connect wallet` / `connect to dapp`                | +5 each |
| `metamask` / `wallet` / `web3` / `ethereum`         | +1 each |

Sites that only contain generic crypto text without wallet connection code will not reach the threshold.

## Output

Results are printed to the console as they are found and saved to `phishing-dapps-<timestamp>.json`.
