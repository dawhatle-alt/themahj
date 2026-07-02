import { motion } from "framer-motion";
import { TileFan, Tile } from "@/components/Tiles";
import type { SiteData } from "@/lib/data";
import { EVENT_TYPE_META, fmtShort } from "@/lib/data";
import portrait from "@/assets/about/image1.jpeg";
import tilesAction from "@/assets/about/image0.jpeg";

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ---------------- HOME ----------------
export function Home({ data, go }: { data: SiteData; go: (p: string) => void }) {
  const upcoming = [...data.events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return (
    <div>
      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-16 grid md:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <div>
          <motion.p className="eyebrow"
            variants={reveal} custom={0} initial="hidden" animate="visible">
            Leander · North Austin, Texas
          </motion.p>
          <motion.h1
            className="font-display text-[clamp(2.8rem,7vw,5.2rem)] leading-[0.98] mt-4"
            variants={reveal} custom={0.1} initial="hidden" animate="visible">
            Pull up a chair.<br />
            <span className="italic" style={{ color: "var(--rose-deep)" }}>The tiles are waiting.</span>
          </motion.h1>
          <motion.p
            className="mt-6 text-lg max-w-md"
            style={{ color: "var(--ink-soft)" }}
            variants={reveal} custom={0.2} initial="hidden" animate="visible">
            The Mahj is a home for American mahjong in the north Austin hill country —
            beginner classes, open play nights, and Troop Mahjong evenings with a little extra sparkle.
          </motion.p>
          <motion.div className="mt-8 flex flex-wrap gap-4"
            variants={reveal} custom={0.3} initial="hidden" animate="visible">
            <button onClick={() => go("events")} className="btn-rose px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em]">
              Classes &amp; Events
            </button>
            <button onClick={() => go("troop")} className="px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em] border transition-colors"
              style={{ borderColor: "var(--jade)", color: "var(--jade)" }}>
              Troop Mahjong
            </button>
          </motion.div>
        </div>
        <motion.div className="py-6"
          initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}>
          <TileFan />
        </motion.div>
      </section>

      <div className="hairline max-w-5xl mx-auto" />

      {/* ── Upcoming events ── */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <motion.div className="flex items-baseline justify-between flex-wrap gap-3"
          variants={reveal} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div>
            <p className="eyebrow">On the calendar</p>
            <h2 className="font-display text-4xl mt-2">Next at the table</h2>
          </div>
          <button onClick={() => go("events")} className="text-sm uppercase tracking-[0.18em] underline underline-offset-4"
            style={{ color: "var(--rose-deep)" }}>
            Full calendar →
          </button>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {upcoming.map((ev, i) => {
            const d = fmtShort(ev.date);
            return (
              <motion.button key={ev.id} onClick={() => go("events")}
                className="text-left bg-white/70 border rounded-lg p-6 tile-hover"
                style={{ borderColor: "#E9DFD0" }}
                variants={reveal} custom={i * 0.1} initial="hidden" whileInView="visible" viewport={{ once: true }}>
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
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* ── Learn / Play / Belong ── */}
      <section style={{ background: "var(--blush)" }}>
        <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-3 gap-10">
          {[
            { face: "bam" as const, t: "Learn", d: "Mahjong 101 & 102 classes that take you from \"what's a crak?\" to calling your first mahj with confidence." },
            { face: "dot" as const, t: "Play", d: "Open play nights and weekend Mahjmosas — tables, tiles, and NMJL cards provided. Come solo; leave with a foursome." },
            { face: "flower" as const, t: "Belong", d: "Troop Mahjong evenings with themed tablescapes, merit stickers, raffle prizes, and a sisterhood around the table." },
          ].map((x, i) => (
            <motion.div key={x.t} className="flex gap-5"
              variants={reveal} custom={i * 0.12} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <Tile face={x.face} size={56} />
              <div>
                <h3 className="font-display text-2xl">{x.t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{x.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------- ABOUT ----------------
export function About({ go }: { go: (p: string) => void }) {
  return (
    <div>
      {/* ── Page header ── */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-4">
        <motion.p className="eyebrow"
          variants={reveal} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          About me
        </motion.p>
        <motion.h1
          className="font-display leading-[0.9] mt-4 tracking-tight"
          style={{ fontSize: "clamp(3rem,8vw,5.8rem)" }}
          variants={reveal} custom={0.08} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          The woman<br />
          <span className="italic" style={{ color: "var(--rose-deep)" }}>behind the tiles.</span>
        </motion.h1>
        <motion.div className="hairline mt-10"
          initial={{ scaleX: 0, opacity: 0 }} whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "left" }} />
      </div>

      {/* ── Two-column bio ── */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-20">
        <div className="grid md:grid-cols-[5fr_7fr] gap-14 items-start">

          {/* Portrait with decorative offset */}
          <motion.div className="relative"
            initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            <div className="absolute -bottom-5 -right-5 w-full h-full rounded-3xl"
              style={{ background: "var(--blush)", zIndex: 0 }} />
            <img
              src={portrait}
              alt="Rhonda, founder of The Mahj Edit"
              className="relative w-full object-cover rounded-3xl"
              style={{
                aspectRatio: "3/4", objectPosition: "top", zIndex: 1,
                border: "2px solid #E3D7C2",
                boxShadow: "0 24px 64px -12px rgba(51,39,43,0.24), 0 4px 16px rgba(51,39,43,0.08)",
              }} />
          </motion.div>

          {/* Bio text */}
          <div className="space-y-6 text-[17px] leading-[1.75]" style={{ color: "var(--ink)" }}>
            <motion.p className="font-display italic text-[1.6rem] leading-snug"
              style={{ color: "var(--rose-deep)" }}
              variants={reveal} custom={0.1} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              I'm Rhonda, founder of The Mahj Edit.
            </motion.p>

            {[
              "The Mahj Edit was born from a simple idea: mahjong should be as beautiful and memorable as the connections it creates.",
              "After discovering the game, I quickly fell in love with its blend of strategy, tradition, and community. What began as a personal passion evolved into a desire to create elevated mahjong experiences where people can learn, gather, and build lasting friendships.",
              "Drawing on years of professional experience in leadership, learning, and skill development, I bring a thoughtful and welcoming approach to teaching. Whether you're brand new to the game or an experienced player looking to expand your circle, my goal is to create an environment where everyone feels comfortable, confident, and inspired.",
              "Through private lessons, group classes, special events, and curated experiences, The Mahj Edit celebrates the art of gathering around the table. I believe the best games are about more than winning — they're about connection, laughter, and creating moments worth remembering.",
            ].map((text, i) => (
              <motion.p key={i}
                variants={reveal} custom={0.18 + i * 0.08}
                initial="hidden" whileInView="visible" viewport={{ once: true }}>
                {text}
              </motion.p>
            ))}

            <motion.p className="font-display italic text-xl pt-1" style={{ color: "var(--gold)" }}
              variants={reveal} custom={0.52} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              Welcome to The Mahj Edit. I'm excited to share a seat at the table with you.
            </motion.p>

            <motion.div variants={reveal} custom={0.58} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <button onClick={() => go("events")}
                className="btn-rose px-8 py-3.5 rounded-full text-sm uppercase tracking-[0.18em] mt-1">
                Find a class
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Pull quote — signature element ── */}
      <div style={{ background: "var(--ivory-deep)" }}>
        <motion.div className="max-w-3xl mx-auto px-6 py-20 text-center"
          initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
          <p className="font-display leading-none mb-6 select-none"
            style={{ fontSize: "6rem", color: "var(--gold)", opacity: 0.35, lineHeight: 0.7 }}>"</p>
          <p className="font-display italic leading-[1.18] tracking-tight"
            style={{ fontSize: "clamp(1.6rem,3.5vw,2.6rem)", color: "var(--ink)" }}>
            The best games are about more than winning — they're about connection, laughter, and creating moments worth remembering.
          </p>
          <div className="mt-10 flex items-center justify-center gap-5">
            <div className="hairline flex-1" style={{ maxWidth: 80 }} />
            <p className="eyebrow">Rhonda &middot; The Mahj Edit</p>
            <div className="hairline flex-1" style={{ maxWidth: 80 }} />
          </div>
        </motion.div>
      </div>

      {/* ── Table photo ── */}
      <motion.div className="max-w-5xl mx-auto px-6 py-16"
        initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
        <img
          src={tilesAction}
          alt="At the mahjong table"
          className="w-full object-contain"
          style={{
            borderRadius: "2rem",
            maxHeight: "520px",
            boxShadow: "0 8px 40px rgba(160,120,80,0.18), 0 2px 12px rgba(0,0,0,0.10)",
            border: "2px solid #E3D7C2",
          }} />
      </motion.div>
    </div>
  );
}

// ---------------- TROOP MAHJONG ----------------
export function Troop({ go }: { go: (p: string) => void }) {
  return (
    <div>
      {/* ── Page header ── */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-4">
        <motion.p className="eyebrow"
          variants={reveal} custom={0} initial="hidden" animate="visible">
          Our chapter
        </motion.p>
        <motion.h1
          className="font-display leading-[0.9] mt-4 tracking-tight"
          style={{ fontSize: "clamp(3rem,8vw,5.2rem)" }}
          variants={reveal} custom={0.08} initial="hidden" animate="visible">
          Troop<br />
          <span className="italic" style={{ color: "var(--jade)" }}>Mahjong.</span>
        </motion.h1>
        <motion.p
          className="mt-6 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--ink-soft)" }}
          variants={reveal} custom={0.18} initial="hidden" animate="visible">
          Troop Mahjong is a national social club founded by Kristel Powell in San Antonio,
          inspired by <em>Troop Beverly Hills</em> — American mahjong with themed events,
          friendship, and community for women. The Mahj is proud to bring the Troop experience
          to the Leander &amp; north Austin area.
        </motion.p>
        <motion.div className="hairline mt-10"
          initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "left" }} />
      </section>

      {/* ── Oath ── */}
      <section className="max-w-5xl mx-auto px-6 pt-10 pb-16">
        <motion.div className="tile max-w-2xl p-8"
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}>
          <p className="eyebrow" style={{ color: "var(--crak)" }}>The Troop Oath</p>
          <p className="font-display italic text-2xl leading-relaxed mt-3">
            "On my honor, I will try: to be friendly and welcoming, to never use a joker in a
            pair, to toast the table on a bird bam, and to play fairly and with good humor at
            all times."
          </p>
        </motion.div>
      </section>

      {/* ── What a Troop night looks like ── */}
      <section style={{ background: "var(--jade-soft)" }}>
        <div className="max-w-5xl mx-auto px-6 py-14">
          <motion.h2 className="font-display text-3xl"
            variants={reveal} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            What a Troop night looks like
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 mt-10">
            {[
              ["Themed tablescapes", "Every event is styled like an occasion — because why not? Expect curated decor, a dress-up theme, and plenty of photo moments."],
              ["Merit stickers", "Every mahj is celebrated. Win a hand, earn a Troop Mahjong merit sticker for your book — there are dozens to collect."],
              ["Player gifts & raffles", "Each event includes little luxuries: player gifts, raffle prizes, and curated touches from brands we love."],
              ["All levels welcome", "Beginners, regulars, and everyone in between. No pressure — just play, connect, and enjoy."],
            ].map(([t, d], i) => (
              <motion.div key={t}
                variants={reveal} custom={i * 0.1} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <h3 className="font-display text-xl" style={{ color: "var(--jade)" }}>{t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{d}</p>
              </motion.div>
            ))}
          </div>
          <motion.div
            variants={reveal} custom={0.4} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <button onClick={() => go("events")} className="btn-jade px-7 py-3 rounded-full text-sm uppercase tracking-[0.18em] mt-12">
              Join the next Troop night
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
