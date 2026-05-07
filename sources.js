// Add or remove blocklist sources here.
// Each source needs: name, url, parse(res) => Promise<string[]>, and optionally optional: true

export const BLOCKLISTS = [
    {
        name: "MetaMask",
        url: "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json",
        parse: async (res) => (await res.json()).blacklist ?? [],
    },
    {
        name: "OpenPhish",
        url: "https://openphish.com/feed.txt",
        optional: true,
        parse: async (res) => {
            const text = await res.text();
            return text
                .split("\n")
                .filter(Boolean)
                .map((u) => {
                    try {
                        return new URL(u.trim()).hostname;
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);
        },
    },
];
