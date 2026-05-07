import { REQUEST_TIMEOUT, USER_AGENT, ACCEPT_LANGUAGE, ACCEPT } from "./constants.js";

const FETCH_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    Accept: ACCEPT,
};

export async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        return await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS });
    } finally {
        clearTimeout(timer);
    }
}

export function extractTitle(html) {
    return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
}

export function extractBodyText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function validateBlocklists(blocklists) {
    if (!Array.isArray(blocklists) || blocklists.length === 0) {
        throw new Error("BLOCKLISTS must be a non-empty array.");
    }
    for (const entry of blocklists) {
        if (!entry.name || typeof entry.name !== "string") {
            throw new Error(`Blocklist entry missing a valid "name": ${JSON.stringify(entry)}`);
        }
        try {
            new URL(entry.url);
        } catch {
            throw new Error(`Blocklist "${entry.name}" has an invalid URL: ${entry.url}`);
        }
        if (typeof entry.parse !== "function") {
            throw new Error(`Blocklist "${entry.name}" is missing a parse function.`);
        }
    }
}
