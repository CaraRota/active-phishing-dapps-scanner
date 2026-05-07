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

| Variable       | Default | Description                                           |
| -------------- | ------- | ----------------------------------------------------- |
| `TARGET_SITES` | `10`    | Stop after finding this many confirmed phishing dapps |
| `CONCURRENCY`  | `25`    | Simultaneous domain checks                            |

## Architecture

Three modules; no build step.

- **`sources.js`** — blocklist source configs (`BLOCKLISTS` array). Each entry has `name`, `url`, `parse(res)`, and optional `optional: true`. Add or remove sources here.
- **`helpers.js`** — `fetchWithTimeout`, `extractTitle`, `extractBodyText`, `validateBlocklists`.
- **`index.js`** — orchestration: loads domains, deduplicates, shuffles, runs the worker pool, writes output.

Flow:

1. **Validate** — checks `BLOCKLISTS` entries are well-formed at startup (fails fast before any network I/O).
2. **Load domains** — fetches all sources in parallel. Optional sources are skipped on failure; required sources propagate the error.
3. **Deduplicate + shuffle** — merges all sources, deduplicates, then shuffles so repeated runs sample different domains.
4. **Worker pool** — `CONCURRENCY` async workers pull from a shared queue. Each worker GETs the domain (HTTPS first, HTTP fallback), checks raw HTML length (`MIN_HTML_LENGTH`), checks visible body text for suspension keywords, then scores the full HTML for signals.
5. **Early exit** — stops the entire pool the moment `TARGET_SITES` qualifying sites are found.
6. **Output** — prints results to console as found; saves full JSON to `phishing-dapps-<timestamp>.json`.

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

Defined in `sources.js`. To add a source, append an entry to the `BLOCKLISTS` array.

- **MetaMask eth-phishing-detect** — `blacklist` array from `src/config.json`. Crypto-specific, ~50k domains. Required source.
- **OpenPhish** — free community feed (`feed.txt`). General phishing, not crypto-specific; treated as secondary (`optional: true`). Fetch failure is non-fatal.

## Output files

- `phishing-dapps-<timestamp>.json` — scan results with per-site score, hints, title, and URL
