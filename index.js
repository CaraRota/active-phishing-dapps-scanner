import fs from "fs";

import {
    DEFAULT_TARGET_SITES,
    DEFAULT_CONCURRENCY,
    SCORE_THRESHOLD,
    MIN_HTML_LENGTH,
    REQUEST_TIMEOUT,
    USER_AGENT,
    ACCEPT_LANGUAGE,
    ACCEPT,
    METAMASK_URL,
    OPENPHISH_URL,
    SUSPENSION_KEYWORDS,
    CRYPTO_SIGNALS,
} from "./constants.js";

const TARGET_SITES = parseInt(process.env.TARGET_SITES) || DEFAULT_TARGET_SITES;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || DEFAULT_CONCURRENCY;

const FETCH_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    Accept: ACCEPT,
};

async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        return await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS });
    } finally {
        clearTimeout(timer);
    }
}

async function loadMetaMaskDomains() {
    try {
        console.log("Fetching MetaMask blacklist...");
        const res = await fetchWithTimeout(METAMASK_URL);
        const data = await res.json();
        const domains = data?.blacklist ?? [];
        console.log(`Fetched ${domains.length} MetaMask domains`);
        return domains;
    } catch (e) {
        console.error(`MetaMask fetch failed: ${e.message}`);
        return [];
    }
}

async function loadOpenPhishDomains() {
    try {
        console.log("Fetching OpenPhish feed...");
        const res = await fetchWithTimeout(OPENPHISH_URL);
        const text = await res.text();
        const domains = [
            ...new Set(
                text
                    .split("\n")
                    .filter(Boolean)
                    .map((u) => {
                        try {
                            return new URL(u.trim()).hostname;
                        } catch {
                            return null;
                        }
                    })
                    .filter(Boolean),
            ),
        ];
        console.log(`Fetched ${domains.length} OpenPhish domains`);
        return domains;
    } catch (e) {
        console.warn(`OpenPhish skipped: ${e.message}`);
        return [];
    }
}

function extractTitle(html) {
    return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
}

function extractBodyText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function analyzeContent(html) {
    const lower = html.toLowerCase();
    const hints = [];
    let score = 0;

    for (const { term, weight } of CRYPTO_SIGNALS) {
        if (lower.includes(term)) {
            score += weight;
            hints.push(term);
        }
    }

    return { score, hints, title: extractTitle(html) };
}

async function checkDomain(domain) {
    for (const protocol of ["https", "http"]) {
        const url = `${protocol}://${domain}`;
        try {
            const res = await fetchWithTimeout(url);
            if (res.status !== 200) continue;

            const html = await res.text();
            if (html.length < MIN_HTML_LENGTH) continue;

            const body = extractBodyText(html).toLowerCase();
            if (SUSPENSION_KEYWORDS.some((k) => body.includes(k))) continue;

            const analysis = analyzeContent(html);
            return { domain, url, ...analysis };
        } catch {
            continue;
        }
    }
    return null;
}

async function findPhishingSites(domains) {
    const found = [];
    const queue = [...domains];
    let checked = 0;
    let stopSignal = false;

    async function worker() {
        while (queue.length > 0 && !stopSignal) {
            const domain = queue.shift();
            if (!domain) break;

            const result = await checkDomain(domain);
            checked++;

            if (result && result.score >= SCORE_THRESHOLD) {
                found.push(result);
                process.stdout.write("\n");
                console.log(
                    `[HIGH] ${result.url} — Score: ${result.score} — ${result.hints.join(", ")}`,
                );
                if (found.length >= TARGET_SITES) {
                    stopSignal = true;
                    return;
                }
            }

            process.stdout.write(
                `\r  Checked: ${checked} | Remaining: ${queue.length} | Found: ${found.length}/${TARGET_SITES}   `,
            );
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    return { found, checked };
}

async function main() {
    console.log(`Target: ${TARGET_SITES} phishing dapps | Concurrency: ${CONCURRENCY}\n`);

    const [metamask, openphish] = await Promise.all([
        loadMetaMaskDomains(),
        loadOpenPhishDomains(),
    ]);

    const allDomains = [...new Set([...metamask, ...openphish])];

    if (!allDomains.length) {
        console.error("No domains loaded. Check your network connection.");
        process.exit(1);
    }

    // Shuffle for variety across runs
    for (let i = allDomains.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allDomains[i], allDomains[j]] = [allDomains[j], allDomains[i]];
    }

    console.log(`Total unique domains: ${allDomains.length}\n`);

    const start = Date.now();
    const { found, checked } = await findPhishingSites(allDomains);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(
        `\n\n===== ${found.length} ACTIVE PHISHING DAPPS FOUND (${elapsed}s, ${checked} domains checked) =====\n`,
    );

    if (!found.length) {
        console.log(
            "No active phishing dapps found. Try running again (shuffle gives different order).",
        );
        return;
    }

    found
        .sort((a, b) => b.score - a.score)
        .forEach((site, i) => {
            console.log(`${i + 1}. [HIGH] ${site.url}`);
            console.log(`   Title: ${site.title || "N/A"}`);
            console.log(`   Score: ${site.score} | ${site.hints.join(", ")}\n`);
        });

    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const outPath = `phishing-dapps-${timestamp}.json`;
    fs.writeFileSync(
        outPath,
        JSON.stringify({ timestamp: new Date().toISOString(), checked, elapsed, found }, null, 2),
    );
    console.log(`Saved to ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
