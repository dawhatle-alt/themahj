import { useEffect, useState } from "react";
import { getContent } from "./api";

// Fallback copy, used when a key has no row yet or the request fails. The
// database is seeded with these same strings, so in normal operation these are
// never rendered — they exist so the About page still reads correctly if the
// content request is slow, blocked, or the table is empty.
//
// Keep the keys in sync with EDITABLE_KEYS in the api-server's routes/content.ts.
export const CONTENT_DEFAULTS: Record<string, string> = {
  "about.eyebrow": "About me",
  "about.headingTop": "The woman",
  "about.headingAccent": "behind the tiles.",
  "about.lead": "Meet the face behind The Mahj Edit. ✨",
  "about.body": [
    "I'm Rhonda, a mahjong enthusiast based in Georgetown, Texas. By day, I work in corporate leadership, but you'll often find me around a mahjong table with friends, family, and fellow enthusiasts.",
    "What started as learning a new game quickly turned into a true passion. While I love the strategy and challenge of mahjong, what keeps me coming back are the friendships, laughter, and connections created around the table, along with the inevitable “Wait…whose turn is it?” moments that seem to happen in every game.",
    "The Mahj Edit was born from that passion and a desire to create thoughtfully curated experiences where people can gather, play, learn, and connect. I'm also excited to be working toward bringing Troop Mahjong to Georgetown and creating even more opportunities for people to enjoy this incredible game together.",
    "Whether you're a seasoned player or new to the game, I'm so glad you're here.",
  ].join("\n\n"),
  "about.closing":
    "Thank you for being here. I'm excited to grow this community with you, one beautiful tile at a time. 🀄",
  "about.quote":
    "The best games are about more than winning — they're about connection, laughter, and creating moments worth remembering.",
  "about.quoteAttribution": "Rhonda · The Mahj Edit",
};

// Same module-level cache as lib/categories.ts: the About page and the admin
// panel both read this, and it should cost one request per page load.
let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;
const subscribers = new Set<(c: Record<string, string>) => void>();

function load(): Promise<Record<string, string>> {
  if (!inflight) {
    inflight = getContent()
      .then((content) => {
        cache = content;
        subscribers.forEach((fn) => fn(content));
        return content;
      })
      .catch(() => {
        // Fall through to CONTENT_DEFAULTS rather than blanking the page.
        inflight = null;
        return {};
      });
  }
  return inflight;
}

/** Clears the cache so the next read refetches — call after an admin save. */
export function invalidateContent(): void {
  cache = null;
  inflight = null;
  void load();
}

/**
 * Returns a lookup that falls back to the built-in default for any key the
 * database has not overridden, so a missing row can never render as blank.
 */
export function useContent(): (key: string) => string {
  const [content, setContent] = useState<Record<string, string>>(cache ?? {});

  useEffect(() => {
    subscribers.add(setContent);
    if (cache) setContent(cache);
    else void load().then(setContent);
    return () => {
      subscribers.delete(setContent);
    };
  }, []);

  return (key: string) => {
    const stored = content[key];
    if (typeof stored === "string" && stored.trim() !== "") return stored;
    return CONTENT_DEFAULTS[key] ?? "";
  };
}

/** Splits a "*.body" value into paragraphs on blank lines. */
export function toParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
