import { TileFan, Tile } from "@/components/Tiles";
import type { SiteData } from "@/lib/data";
import { EVENT_TYPE_META, fmtShort } from "@/lib/data";

// ---------------- HOME ----------------
export function Home({ data, go }: { data: SiteData; go: (p: string) => void }) {
  const upcoming = [...data.events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return (
    <div>
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-16 grid md:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <div>
          <p className="eyebrow fade-up">Leander · North Austin, Texas</p>
          <h1 className="font-display fade-up fade-up-1 text-[clamp(2.8rem,7vw,5.2rem)] leading-[0.98] mt-4">
            Pull up a chair.
            <br />
            <span className="italic" style={{ color: "var(--rose-deep)" }}>The tiles are waiting.</span>
          </h1>
          <p className="fade-up fade-up-2 mt-6 text-lg max-w-md" style={{ color: "var(--ink-soft)" }}>
            The Mahj is a home for American mahjong in the north Austin hill country —
            beginner classes, open play nights, and Troop Mahjong evenings with a little extra sparkle.
          </p>
          <div className="fade-up fade-up-3 mt-8 flex flex-wrap gap-4">
            <button onClick={() => go("events")} className="btn-rose px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em]">
              Classes &amp; Events
            </button>
            <button onClick={() => go("troop")} className="px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em] border transition-colors"
              style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>
              Troop Mahjong
            </button>
          </div>
        </div>
        <div className="fade-up fade-up-2 py-6"><TileFan /></div>
      </section>

      <div className="hairline max-w-5xl mx-auto" />

      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow">On the calendar</p>
            <h2 className="font-display text-4xl mt-2">Next at the table</h2>
          </div>
          <button onClick={() => go("events")} className="text-sm uppercase tracking-[0.18em] underline underline-offset-4" style={{ color: "var(--rose-deep)" }}>
            Full calendar →
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {upcoming.map(ev => {
            const d = fmtShort(ev.date);
            return (
              <button key={ev.id} onClick={() => go("events")}
                className="text-left bg-white/70 border rounded-lg p-6 tile-hover"
                style={{ borderColor: "#E9DFD0" }}>
                <div className="flex items-start gap-4">
                  <div className="tile flex flex-col items-center justify-center w-14 h-[72px] shrink-0">
                    <span className="text-[10px] tracking-[0.2em]" style={{ color: "var(--crak)" }}>{d.mon}</span>
                    <span className="font-display text-2xl leading-none mt-1">{d.day}</span>
                  </div>
                  <div>
                    <span className={`inline-block text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${EVENT_TYPE_META[ev.type].chip}`}>
                      {EVENT_TYPE_META[ev.type].label}
                    </span>
                    <h3 className="font-display text-xl mt-2 leading-snug">{ev.title}</h3>
                    <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>{ev.time}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ background: "var(--blush)" }}>
        <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-3 gap-10">
          {[
            { face: "bam" as const, t: "Learn", d: "Mahjong 101 & 102 classes that take you from \"what's a crak?\" to calling your first mahj with confidence." },
            { face: "dot" as const, t: "Play", d: "Open play nights and weekend Mahjmosas — tables, tiles, and NMJL cards provided. Come solo; leave with a foursome." },
            { face: "flower" as const, t: "Belong", d: "Troop Mahjong evenings with themed tablescapes, merit stickers, raffle prizes, and a sisterhood around the table." },
          ].map(x => (
            <div key={x.t} className="flex gap-5">
              <Tile face={x.face} size={56} />
              <div>
                <h3 className="font-display text-2xl">{x.t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{x.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------- ABOUT ----------------
export function About({ go }: { go: (p: string) => void }) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <p className="eyebrow">About me</p>
      <h1 className="font-display text-5xl mt-3">The woman behind the tiles</h1>
      <div className="grid md:grid-cols-[1fr_1.4fr] gap-12 mt-10 items-start">
        <div>
          <div className="tile w-full aspect-[3/4] flex flex-col items-center justify-center gap-4 p-8">
            <Tile face="flower" size={72} />
            <p className="font-display italic text-xl text-center" style={{ color: "var(--ink-soft)" }}>
              Your photo here
            </p>
            <p className="text-xs text-center" style={{ color: "var(--ink-soft)" }}>
              (Swap in a portrait from your Graphics folder)
            </p>
          </div>
        </div>
        <div className="space-y-5 text-[17px] leading-relaxed" style={{ color: "var(--ink)" }}>
          <p>
            Hi, I'm Patsy — teacher, hostess, and unapologetic collector of beautiful tiles.
            What started as a weekly game with girlfriends turned into a full-blown love affair
            with American mahjong, and The Mahj is where I get to share it.
          </p>
          <p>
            I believe the game is only half of it. The other half is the table itself: the
            chatter between hands, the celebratory toast on a hard-won mahj, the friend you
            didn't have before you sat down. Every class and event I host is built around that.
          </p>
          <p>
            Whether you've never touched a tile or you've been playing since your grandmother
            taught you, there's a seat for you here in Leander.
          </p>
          <p className="font-display italic text-2xl pt-2" style={{ color: "var(--rose-deep)" }}>
            — Come play with us.
          </p>
          <button onClick={() => go("events")} className="btn-rose px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em] mt-2">
            Find a class
          </button>
        </div>
      </div>
      <p className="mt-12 text-xs" style={{ color: "var(--ink-soft)" }}>
        ✎ This bio is placeholder copy — tell me your real story and I'll rewrite it in your voice.
      </p>
    </div>
  );
}

// ---------------- TROOP MAHJONG ----------------
export function Troop({ go }: { go: (p: string) => void }) {
  return (
    <div>
      <section className="max-w-5xl mx-auto px-6 py-14">
        <p className="eyebrow">Our chapter</p>
        <h1 className="font-display text-5xl mt-3">Troop Mahjong</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Troop Mahjong is a national social club founded by Kristel Powell in San Antonio,
          inspired by <em>Troop Beverly Hills</em> — American mahjong with themed events,
          friendship, and community for women. The Mahj is proud to bring the Troop experience
          to the Leander &amp; north Austin area.
        </p>

        <div className="tile max-w-2xl mt-10 p-8">
          <p className="eyebrow" style={{ color: "var(--crak)" }}>The Troop Oath</p>
          <p className="font-display italic text-2xl leading-relaxed mt-3">
            "On my honor, I will try: to be friendly and welcoming, to never use a joker in a
            pair, to toast the table on a bird bam, and to play fairly and with good humor at
            all times."
          </p>
        </div>
      </section>

      <section style={{ background: "var(--jade-soft)" }}>
        <div className="max-w-5xl mx-auto px-6 py-14">
          <h2 className="font-display text-3xl">What a Troop night looks like</h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-7 mt-8">
            {[
              ["Themed tablescapes", "Every event is styled like an occasion — because why not? Expect curated decor, a dress-up theme, and plenty of photo moments."],
              ["Merit stickers", "Every mahj is celebrated. Win a hand, earn a Troop Mahjong merit sticker for your book — there are dozens to collect."],
              ["Player gifts & raffles", "Each event includes little luxuries: player gifts, raffle prizes, and curated touches from brands we love."],
              ["All levels welcome", "Beginners, regulars, and everyone in between. No pressure — just play, connect, and enjoy."],
            ].map(([t, d]) => (
              <div key={t}>
                <h3 className="font-display text-xl" style={{ color: "var(--jade)" }}>{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{d}</p>
              </div>
            ))}
          </div>
          <button onClick={() => go("events")} className="btn-jade px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em] mt-10">
            Join the next Troop night
          </button>
        </div>
      </section>
    </div>
  );
}
