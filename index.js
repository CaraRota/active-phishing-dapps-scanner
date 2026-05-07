import fs from "fs";
import {
    DEFAULT_TARGET_SITES,
    DEFAULT_CONCURRENCY,
    SCORE_THRESHOLD,
    MIN_HTML_LENGTH,
    SUSPENSION_KEYWORDS,
    CRYPTO_SIGNALS,
} from "./constants.js";
import { BLOCKLISTS } from "./sources.js";
import { fetchWithTimeout, extractTitle, extractBodyText, validateBlocklists } from "./helpers.js";

const TARGET_SITES = parseInt(process.env.TARGET_SITES) || DEFAULT_TARGET_SITES;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || DEFAULT_CONCURRENCY;

async function loadDomains({ name, url, parse, optional }) {
    try {
        console.log(`Fetching ${name}...`);
        const res = await fetchWithTimeout(url);
        const domains = await parse(res);
        console.log(`Fetched ${domains.length} ${name} domains`);
        return domains;
    } catch (e) {
        if (optional) {
            console.warn(`${name} skipped: ${e.message}`);
            return [];
        }
        throw new Error(`${name} fetch failed: ${e.message}`);
    }
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
    validateBlocklists(BLOCKLISTS);
    console.log(`Target: ${TARGET_SITES} phishing dapps | Concurrency: ${CONCURRENCY}\n`);

    const results = await Promise.all(BLOCKLISTS.map(loadDomains));
    const allDomains = [...new Set(results.flat())];

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

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
