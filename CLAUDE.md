# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Security testing tool for crypto wallet developers. Quickly finds currently active phishing dapps from public blocklists to use as test targets when verifying that wallets properly block or warn about deceptive dapp connection attempts. Run twice a year before wallet security testing rounds.

## Running

```bash
node index.js
```

No build step. No dependencies. Node.js ESM (`"type": "module"` in package.json). Requires Node ≥ 18 (native `fetch`).

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `TARGET_SITES` | `10` | Stop after finding this many confirmed phishing dapps |
| `CONCURRENCY` | `25` | Simultaneous domain checks |

## Architecture

Single-file script (`index.js`). Flow:

1. **Load domains** — fetches MetaMask's eth-phishing-detect blacklist and OpenPhish feed in parallel, always fresh.
2. **Deduplicate + shuffle** — merges both sources, deduplicates, then shuffles so repeated runs sample different domains.
3. **Worker pool** — `CONCURRENCY` async workers pull from a shared queue. Each worker GETs the domain (HTTPS first, HTTP fallback), checks raw HTML length (`MIN_HTML_LENGTH`), checks visible body text for suspension keywords, then scores the full HTML for signals.
4. **Early exit** — stops the entire pool the moment `TARGET_SITES` qualifying sites are found.
5. **Output** — prints results to console as found; saves full JSON to `phishing-dapps-<timestamp>.json`.

## Scoring system

Only sites with score ≥ 8 are reported. Signals are checked against the full HTML including inline scripts:

Active wallet connection API:
- `eth_requestaccounts` → +6
- `window.ethereum` / `walletconnect` → +4 each
- `web3modal` / `rainbowkit` / `wagmi` / `connectkit` → +2 each

UI phishing:
- `connect wallet` / `connect to dapp` → +5 each
- `metamask` / `wallet` / `web3` / `ethereum` → +1 each

## Sources

- **MetaMask eth-phishing-detect** — `blacklist` array from `src/config.json`. Crypto-specific, ~50k domains. Always fetched fresh from GitHub.
- **OpenPhish** — free community feed (`feed.txt`). General phishing, not crypto-specific; treated as secondary. Fetch failure is non-fatal.

## Output files

- `phishing-dapps-<timestamp>.json` — scan results with per-site score, hints, title, and URL
