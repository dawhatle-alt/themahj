import { useEffect, useState } from "react";
import { getContent } from "./api";

// Fallback copy, used when a key has no row yet or the request fails. The
// database is seeded with these same strings, so in normal operation these are
// never rendered — they exist so a page still reads correctly if the content
// request is slow, blocked, or the table is empty.
//
// Keep the keys in sync with EDITABLE_KEYS in the api-server's routes/content.ts.
export const CONTENT_DEFAULTS: Record<string, string> = {
  // ---- About page ----
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

  // ---- Private events page ----
  "privateEvents.eyebrow": "Private events",
  "privateEvents.headingTop": "Private Mahjong Events,",
  "privateEvents.headingAccent": "beautifully done.",
  "privateEvents.intro":
    "Turn your next gathering into a mahjong experience your guests will remember. The Mahj Edit brings the tablescape, the mahjong, and the details together for a stylish and effortless event — so you can enjoy your guests while we take care of the setup.",
  "privateEvents.perfectForLabel": "Perfect for",
  "privateEvents.perfectFor": [
    "Birthdays",
    "Girls’ Nights",
    "Bridal Events",
    "Neighborhood Gatherings",
    "Corporate Events",
    "Client Entertainment",
    "Celebrations",
    "Just Because",
  ].join("\n"),
  "privateEvents.featuresHeading": "What Makes a Mahj Edit Event Special",
  "privateEvents.features": [
    "Everything You Need\nWe bring the mats, tiles, racks, and game essentials needed for your event.",
    "Beautifully Styled Tables\nThoughtfully coordinated mahjong setups make your event feel polished, elevated, and photo-worthy.",
    "Customized for Your Event\nFrom an intimate gathering at home to a larger celebration, we tailor the setup to your group, space, and occasion.",
    "You Enjoy the Party\nWe take care of the mahjong setup and details so you can spend your time enjoying your guests.",
  ].join("\n\n"),
  "privateEvents.ctaHeading": "Ready to Gather Around the Table?",
  "privateEvents.ctaBody":
    "Tell us a little about your event, and we’ll help create a mahjong experience designed for your group.",
  "privateEvents.ctaButton": "Inquire about a private event",

  // ---- Private lessons page ----
  "privateLessons.eyebrow": "Private lessons",
  "privateLessons.headingTop": "Private Mahjong Lessons,",
  "privateLessons.headingAccent": "at your pace.",
  "privateLessons.intro":
    "Learn American mahjong in a relaxed, unhurried setting — just you and the people you would like to learn with. Whether you are picking up your first tile or brushing up before joining open play, we start exactly where you are.",
  "privateLessons.perfectForLabel": "Perfect for",
  "privateLessons.perfectFor": [
    "Complete Beginners",
    "Friends Learning Together",
    "Getting Ready for Open Play",
    "Brushing Up on the Card",
    "Mothers & Daughters",
    "Neighbors & Book Clubs",
    "Couples",
    "One-on-One",
  ].join("\n"),
  "privateLessons.featuresHeading": "What Makes a Mahj Edit Lesson Different",
  "privateLessons.features": [
    "Everything Provided\nTiles, racks, mats, and current National Mah Jongg League cards are set up and waiting — you just bring yourself.",
    "At Your Pace, Not a Room’s\nNo keeping up with a class. We move as quickly or as slowly as you like, and go back over anything that has not clicked yet.",
    "Learn With Your Own People\nBring a friend, your neighbors, or your daughter. Learning together means you will have a table to play at long after the lesson ends.",
    "Playing by the End\nYou will not just listen — you will play real hands, with the card in front of you and the confidence to actually use it.",
  ].join("\n\n"),
  "privateLessons.ctaHeading": "Ready to Learn?",
  "privateLessons.ctaBody":
    "Tell us who is learning and what you would like to get out of it, and we will suggest the right lesson for you.",
  "privateLessons.ctaButton": "Inquire about private lessons",

  // ---- Shown on the site ----
  // The address guests are told to write to. Separate from OWNER_EMAIL, which
  // is the reply-to on outgoing mail and is set in Vercel; keep them the same
  // unless there is a reason not to.
  "contact.email": "themahjeditco@gmail.com",
};

// Same module-level cache as lib/categories.ts: several pages and the admin
// panel read this, and it should cost one request per page load.
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

/**
 * Splits a "*.features" value into heading/body blocks. Blocks are separated by
 * blank lines; within a block the first line is the heading and the rest is the
 * body. One rule deeper than toParagraphs — it keeps the admin field a single
 * textarea rather than four pairs of inputs.
 */
export function toBlocks(value: string): { title: string; body: string }[] {
  return toParagraphs(value)
    .map((block) => {
      const [title, ...rest] = block.split("\n");
      return { title: (title ?? "").trim(), body: rest.join(" ").trim() };
    })
    .filter((b) => b.title);
}

/** Splits a newline-separated list value, ignoring blank lines. */
export function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
