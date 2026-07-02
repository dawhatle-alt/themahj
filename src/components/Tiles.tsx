// Hand-drawn-feeling mahjong tiles in SVG, used as the brand's signature element.

const FACE: Record<string, JSX.Element> = {
  flower: (
    <g>
      <circle cx="50" cy="42" r="13" fill="none" stroke="#C9697E" strokeWidth="4" />
      {[0, 60, 120, 180, 240, 300].map(a => (
        <ellipse key={a} cx="50" cy="20" rx="8" ry="13" fill="#C9697E" opacity="0.85"
          transform={`rotate(${a} 50 42)`} />
      ))}
      <circle cx="50" cy="42" r="6" fill="#B98A4A" />
      <path d="M50 58 Q46 74 50 88" fill="none" stroke="#2E6B5A" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 70 Q60 64 66 70 Q58 78 50 73" fill="#2E6B5A" />
    </g>
  ),
  bam: (
    <g stroke="#2E6B5A" strokeWidth="5" strokeLinecap="round" fill="none">
      <path d="M50 16 V40 M50 46 V70 M50 76 V88" />
      <path d="M42 18 H58 M42 42 H58 M42 72 H58 M42 86 H58" strokeWidth="4" />
      <path d="M40 30 Q50 26 60 30 M40 58 Q50 54 60 58" strokeWidth="3" opacity="0.7" />
    </g>
  ),
  crak: (
    <g fill="#B33A3A" fontFamily="Georgia, serif" textAnchor="middle">
      <text x="50" y="46" fontSize="38" fontWeight="bold">萬</text>
      <text x="50" y="86" fontSize="30" fill="#33272B">一</text>
    </g>
  ),
  dot: (
    <g>
      {[[33, 30], [67, 30], [33, 56], [67, 56], [33, 82], [67, 82]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="11" fill="none" stroke={i % 2 ? "#2E6B5A" : "#C9697E"} strokeWidth="4" />
          <circle cx={x} cy={y} r="4" fill={i % 2 ? "#2E6B5A" : "#C9697E"} />
        </g>
      ))}
    </g>
  ),
  joker: (
    <g fill="#A94B61" fontFamily="Georgia, serif" textAnchor="middle">
      <text x="50" y="60" fontSize="20" fontStyle="italic" letterSpacing="2">JOKER</text>
      <path d="M30 72 Q50 84 70 72" stroke="#B98A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="32" r="9" fill="none" stroke="#B98A4A" strokeWidth="3" />
      <path d="M44 30 L50 22 L56 30" stroke="#B98A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ),
};

export function Tile({ face, size = 84, className = "", rotate = 0 }: {
  face: keyof typeof FACE; size?: number; className?: string; rotate?: number;
}) {
  return (
    <div
      className={`tile inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size * 1.32, transform: rotate ? `rotate(${rotate}deg)` : undefined }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 104" width={size * 0.78} height={size * 1.05}>{FACE[face]}</svg>
    </div>
  );
}

export function TileFan() {
  const faces: (keyof typeof FACE)[] = ["bam", "crak", "dot", "flower", "joker"];
  const rots = [-14, -7, 0, 7, 14];
  const lifts = [26, 10, 0, 10, 26];
  return (
    <div className="relative flex items-end justify-center" aria-hidden="true">
      {faces.map((f, i) => (
        <div key={f} className="tile-hover" style={{ marginLeft: i ? -18 : 0, transform: `translateY(${lifts[i]}px)` }}>
          <Tile face={f} size={92} rotate={rots[i]} />
        </div>
      ))}
    </div>
  );
}

export function TileMark({ size = 30 }: { size?: number }) {
  return <Tile face="flower" size={size} />;
}
