/**
 * Slides for the first-run usage guide.
 *
 * The illustrations are schematic on purpose: they show the *shape* of each
 * idea (a branch, a ribbon, a row of beats) rather than screenshots, so they
 * stay correct as the real UI moves and never need re-capturing. All colour
 * comes from the same tokens the app uses, so they follow light/dark.
 */

const TILE = { w: 38, h: 30, rx: 6 };

function Tile({ x, y, tone = "plain", label }) {
  const fill = tone === "accent" ? "var(--accent-tint)" : "var(--surface-2)";
  const stroke = tone === "accent" ? "var(--accent)" : "var(--border)";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={TILE.w}
        height={TILE.h}
        rx={TILE.rx}
        fill={fill}
        stroke={stroke}
        strokeWidth={tone === "accent" ? 2 : 1}
      />
      {label && (
        <text
          x={x + 5}
          y={y + 11}
          fontSize={7}
          fontFamily="var(--font-mono), monospace"
          fill="var(--text-muted)"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function Caption({ x, y, children, anchor = "middle" }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={8}
      textAnchor={anchor}
      fill="var(--text-muted)"
      fontFamily="var(--font-sans), system-ui, sans-serif"
    >
      {children}
    </text>
  );
}

const Frame = ({ children }) => (
  <svg viewBox="0 0 280 130" role="img" className="h-auto w-full" aria-hidden>
    {children}
  </svg>
);

/** A thin line: one take replacing another. */
function RegenEdge({ x1, y1, x2, y2 }) {
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
      fill="none"
      stroke="var(--border-strong)"
      strokeWidth={1.5}
    />
  );
}

/** The perforated film ribbon: the next moment in time. */
function ExtendEdge({ x1, y1, x2, y2 }) {
  const d = `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
  return (
    <>
      <path d={d} fill="none" stroke="var(--text-muted)" strokeWidth={9} strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--bg)" strokeWidth={3.5} strokeDasharray="3.5 5" />
    </>
  );
}

const LineageArt = () => (
  <Frame>
    <Tile x={60} y={10} />
    <Tile x={121} y={10} tone="accent" />
    <Tile x={182} y={10} />
    <RegenEdge x1={140} y1={40} x2={110} y2={62} />
    <RegenEdge x1={140} y1={40} x2={170} y2={62} />
    <Tile x={91} y={62} />
    <Tile x={151} y={62} />
    <Caption x={140} y={118}>
      One collection = one family tree of attempts
    </Caption>
  </Frame>
);

const ComposeArt = () => (
  <Frame>
    <rect x={14} y={14} width={92} height={86} rx={8} fill="var(--surface-2)" stroke="var(--border)" />
    <rect x={24} y={26} width={72} height={4} rx={2} fill="var(--border-strong)" />
    <rect x={24} y={36} width={58} height={4} rx={2} fill="var(--border-strong)" />
    <rect x={24} y={46} width={66} height={4} rx={2} fill="var(--border-strong)" />
    <rect x={24} y={76} width={72} height={14} rx={7} fill="var(--accent-solid)" />
    <text
      x={60}
      y={86}
      fontSize={7}
      textAnchor="middle"
      fill="var(--on-accent-solid)"
      fontFamily="var(--font-sans), system-ui, sans-serif"
    >
      Generate
    </text>
    <path d="M112 57 h22" stroke="var(--border-strong)" strokeWidth={1.5} />
    <path d="M134 57 l-5 -3 v6 z" fill="var(--border-strong)" />
    <Tile x={146} y={26} />
    <Tile x={196} y={26} />
    <Tile x={146} y={64} />
    <Tile x={196} y={64} />
    <Caption x={140} y={118}>
      Describe what you want — you get a few takes to choose from
    </Caption>
  </Frame>
);

const BranchArt = () => (
  <Frame>
    <Tile x={121} y={8} tone="accent" />
    <circle cx={140} cy={23} r={22} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.4} />
    <RegenEdge x1={140} y1={38} x2={101} y2={64} />
    <RegenEdge x1={140} y1={38} x2={140} y2={64} />
    <RegenEdge x1={140} y1={38} x2={179} y2={64} />
    <Tile x={82} y={64} />
    <Tile x={121} y={64} />
    <Tile x={160} y={64} />
    <Caption x={140} y={118}>
      Click any take, then generate again — the new ones hang off it
    </Caption>
  </Frame>
);

const EdgeArt = () => (
  <Frame>
    <Tile x={30} y={16} />
    <RegenEdge x1={49} y1={46} x2={49} y2={80} />
    <Tile x={30} y={80} />
    <rect x={86} y={30} width={168} height={44} rx={8} fill="var(--surface)" stroke="var(--accent)" />
    <text
      x={98}
      y={47}
      fontSize={8}
      fill="var(--text)"
      fontFamily="var(--font-sans), system-ui, sans-serif"
    >
      &ldquo;warmer light, tighter crop&rdquo;
    </text>
    <rect x={98} y={56} width={92} height={3.5} rx={1.75} fill="var(--border-strong)" />
    <Caption x={140} y={118}>
      Hover the line between two takes to see the prompt that changed it
    </Caption>
  </Frame>
);

const ReferenceArt = () => (
  <Frame>
    <Tile x={34} y={54} />
    <path
      d="M53 54 Q 140 6 227 54"
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.5}
      strokeDasharray="5 5"
      opacity={0.8}
    />
    <Tile x={208} y={54} />
    <rect x={228} y={48} width={22} height={11} rx={5.5} fill="var(--accent-solid)" />
    <text
      x={239}
      y={56}
      fontSize={6.5}
      textAnchor="middle"
      fill="var(--on-accent-solid)"
      fontFamily="var(--font-sans), system-ui, sans-serif"
    >
      REF
    </text>
    <Caption x={140} y={118}>
      Point at a look you liked — even from another collection
    </Caption>
  </Frame>
);

const TakeVsContinueArt = () => (
  <Frame>
    <Tile x={110} y={8} label="01" />
    <RegenEdge x1={129} y1={38} x2={62} y2={72} />
    <Tile x={43} y={72} label="01" />
    <Caption x={62} y={112}>
      New take
    </Caption>
    <ExtendEdge x1={129} y1={38} x2={216} y2={72} />
    <Tile x={197} y={72} label="02" />
    <Caption x={216} y={112}>
      Continue
    </Caption>
    <Caption x={140} y={60} anchor="middle">
      same moment ← → next moment
    </Caption>
  </Frame>
);

const CutArt = () => (
  <Frame>
    {[0, 1, 2].map((i) => {
      const x = 40 + i * 70;
      return (
        <g key={i}>
          <rect x={x} y={34} width={56} height={40} rx={5} fill="var(--surface-2)" stroke="var(--border)" />
          {[0, 1, 2, 3, 4].map((j) => (
            <g key={j}>
              <rect x={x + 5 + j * 10} y={36} width={4} height={3} rx={1} fill="var(--bg)" />
              <rect x={x + 5 + j * 10} y={69} width={4} height={3} rx={1} fill="var(--bg)" />
            </g>
          ))}
          <text
            x={x + 6}
            y={53}
            fontSize={8}
            fontFamily="var(--font-mono), monospace"
            fill="var(--text-muted)"
          >
            {`0${i + 1}`}
          </text>
        </g>
      );
    })}
    <path d="M104 54 h6 M174 54 h6" stroke="var(--text-muted)" strokeWidth={1.5} />
    <Caption x={140} y={118}>
      Your continuations line up into one video you can play any time
    </Caption>
  </Frame>
);

const SHARED_SLIDES = [
  {
    title: "Every attempt stays connected",
    body: "Fomi is not a feed. Each collection is a tree of takes, so you can always see which version came from which.",
    art: <LineageArt />,
  },
  {
    title: "Describe it, get options",
    body: "Type what you want in the panel on the left and hit Generate. You get several takes at once — pick the one closest to right.",
    art: <ComposeArt />,
  },
  {
    title: "Change your mind from anywhere",
    body: "Click any take to select it, tweak the words, and generate again. The new versions attach underneath it instead of replacing it.",
    art: <BranchArt />,
  },
  {
    title: "See what you changed",
    body: "The line joining two takes carries the prompt that made the difference. Hover it to read that instruction back.",
    art: <EdgeArt />,
  },
  {
    title: "Reuse a look you like",
    body: "Mark any take as a reference and your next generation will borrow from it — even across collections.",
    art: <ReferenceArt />,
  },
];

const VIDEO_SLIDES = [
  {
    title: "New take, or what happens next",
    body: "With a clip selected you get two choices. New take gives you another version of the same moment. Continue makes the moment that follows it.",
    art: <TakeVsContinueArt />,
  },
  {
    title: "The clips become one video",
    body: "Everything you continue lines up in order along the bottom strip. Press play to watch the whole thing, or swap any moment for one of its other takes.",
    art: <CutArt />,
  },
];

export function guideSlides(kind) {
  if (kind !== "video") return SHARED_SLIDES;
  // The video-specific ideas only make sense once branching is understood, so
  // they come after the shared ones rather than opening the guide.
  return [...SHARED_SLIDES.slice(0, 3), ...VIDEO_SLIDES, ...SHARED_SLIDES.slice(3)];
}
