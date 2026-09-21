import { memo, type ReactElement } from 'react';

interface Props {
  artId: string;
  accent: string;
  size?: number;
}

/** Original SVG artwork per game — no external images, no copyrighted art. */
export const GameArt = memo(function GameArt({ artId, accent, size = 88 }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-hidden
      className="gv-gameart"
      style={{ filter: `drop-shadow(0 6px 16px ${accent}44)` }}
    >
      <rect x="0" y="0" width="100" height="100" rx="14" fill="#0b1120" />
      <rect x="3" y="3" width="94" height="94" rx="12" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="2" />
      <GridLines accent={accent} />
      {ART[artId]?.(accent) ?? FALLBACK(accent)}
    </svg>
  );
});

function GridLines({ accent }: { accent: string }) {
  return (
    <g stroke={accent} strokeOpacity="0.14" strokeWidth="1">
      <line x1="50" y1="6" x2="50" y2="94" />
      <line x1="6" y1="50" x2="94" y2="50" />
    </g>
  );
}

type Painter = (accent: string) => ReactElement;

const FALLBACK: Painter = (a) => <circle cx="50" cy="50" r="14" fill={a} />;

const ART: Record<string, Painter> = {
  snake: (a) => (
    <g>
      <path d="M18 62 L18 40 L44 40 L44 62 L66 62 L66 30 L80 30" fill="none" stroke={a} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="80" cy="30" r="6" fill={a} />
      <circle cx="80" cy="22" r="3" fill="#fff" fillOpacity="0.9" />
    </g>
  ),
  bricks: (a) => (
    <g>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}${c}`} x={16 + c * 18} y={18 + r * 12} width="15" height="8" rx="2" fill={(r + c) % 3 === 0 ? a : '#334155'} />
        )),
      )}
      <circle cx="78" cy="44" r="5" fill="#fff" />
      <rect x="30" y="76" width="40" height="7" rx="3.5" fill={a} />
    </g>
  ),
  ship: (a) => (
    <g>
      <polygon points="50,14 64,44 58,40 50,58 42,40 36,44" fill="none" stroke={a} strokeWidth="4" strokeLinejoin="round" />
      <polygon points="28,68 36,58 32,72" fill={a} fillOpacity="0.85" />
      <line x1="14" y1="30" x2="24" y2="30" stroke="#fff" strokeWidth="2" />
      <line x1="76" y1="74" x2="86" y2="74" stroke="#fff" strokeWidth="2" />
    </g>
  ),
  invaders: (a) => (
    <g>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={22 + c * 18} y={18 + r * 14} width="12" height="10" rx="2" fill={r === 1 ? a : '#475569'} />
        )),
      )}
      <rect x="46" y="74" width="8" height="10" fill="#fff" />
      <line x1="50" y1="46" x2="50" y2="70" stroke="#fff" strokeWidth="2" strokeDasharray="2 3" />
    </g>
  ),
  pong: (a) => (
    <g>
      <line x1="50" y1="12" x2="50" y2="88" stroke="#475569" strokeWidth="2" strokeDasharray="4 5" />
      <rect x="14" y="36" width="7" height="28" rx="3.5" fill={a} />
      <rect x="79" y="36" width="7" height="28" rx="3.5" fill={a} />
      <circle cx="52" cy="50" r="5" fill="#fff" />
    </g>
  ),
  racer: (a) => (
    <g>
      <path d="M20 78 C 14 40, 46 18, 78 30 C 88 34, 84 62, 58 64 C 40 66, 50 84, 70 82" fill="none" stroke={a} strokeWidth="6" strokeLinecap="round" />
      <circle cx="70" cy="82" r="5" fill="#fff" />
    </g>
  ),
  blocks: (a) => (
    <g>
      <rect x="28" y="58" width="16" height="16" fill={a} />
      <rect x="44" y="58" width="16" height="16" fill={a} fillOpacity="0.85" />
      <rect x="60" y="58" width="16" height="16" fill={a} fillOpacity="0.7" />
      <rect x="36" y="42" width="16" height="16" fill={a} fillOpacity="0.9" />
      <rect x="52" y="42" width="16" height="16" fill={a} fillOpacity="0.5" />
      <rect x="36" y="26" width="16" height="16" fill="#fff" fillOpacity="0.9" />
    </g>
  ),
  mines: (a) => (
    <g>
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}${c}`} x={20 + c * 16} y={20 + r * 16} width="12" height="12" rx="2" fill={(r * 4 + c) % 5 === 0 ? '#334155' : '#1e293b'} stroke={a} strokeOpacity={(r * 4 + c) % 5 === 0 ? 0 : 0.4} />
        )),
      )}
      <circle cx="60" cy="64" r="6" fill={a} />
      <line x1="60" y1="56" x2="60" y2="60" stroke="#fff" strokeWidth="2" />
    </g>
  ),
  memory: (a) => (
    <g>
      <rect x="22" y="28" width="24" height="32" rx="4" fill="#1e293b" stroke={a} />
      <rect x="54" y="28" width="24" height="32" rx="4" fill={a} fillOpacity="0.25" stroke={a} />
      <circle cx="34" cy="44" r="6" fill={a} />
      <path d="M62 38 l8 8 M70 38 l-8 8" stroke={a} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 74 q26 -14 52 0" stroke={a} strokeWidth="2" fill="none" strokeDasharray="3 4" />
    </g>
  ),
  towers: (a) => (
    <g>
      <path d="M12 74 H 88" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      <rect x="24" y="40" width="12" height="20" fill={a} />
      <circle cx="30" cy="34" r="8" fill={a} />
      <rect x="58" y="48" width="12" height="12" fill={a} fillOpacity="0.8" />
      <circle cx="64" cy="42" r="6" fill={a} fillOpacity="0.8" />
      <circle cx="82" cy="70" r="5" fill="#fff" />
      <circle cx="16" cy="70" r="4" fill={a} />
    </g>
  ),
  connect4: (a) => (
    <g>
      <rect x="18" y="20" width="64" height="58" rx="4" fill="#1e293b" stroke={a} strokeOpacity="0.5" />
      <circle cx="30" cy="70" r="7" fill={a} />
      <circle cx="46" cy="70" r="7" fill={a} />
      <circle cx="62" cy="70" r="7" fill={a} />
      <circle cx="30" cy="54" r="7" fill={a} />
      <circle cx="46" cy="54" r="7" fill="#ef4444" opacity="0.9" />
      <circle cx="46" cy="38" r="7" fill={a} fillOpacity="0.35" stroke={a} />
    </g>
  ),
  checkers: (a) => (
    <g>
      <rect x="20" y="20" width="60" height="60" fill="#0f172a" />
      {[0, 2].map((r) =>
        [0, 2].map((c) => (
          <rect key={`${r}${c}`} x={20 + c * 20} y={20 + r * 20} width="20" height="20" fill={a} fillOpacity="0.12" />
        )),
      )}
      <circle cx="30" cy="70" r="8" fill={a} />
      <circle cx="70" cy="30" r="8" fill="#f8fafc" fillOpacity="0.9" />
      <circle cx="50" cy="50" r="8" fill={a} fillOpacity="0.7" />
    </g>
  ),
  maze: (a) => (
    <g stroke={a} strokeWidth="4" fill="none" strokeLinecap="square">
      <path d="M20 80 V 24 H 44 V 56 H 28" />
      <path d="M60 24 V 44 H 80 V 24" />
      <path d="M44 72 H 80 V 60" />
    </g>
  ),
  runner: (a) => (
    <g>
      <line x1="10" y1="76" x2="90" y2="76" stroke="#475569" strokeWidth="3" />
      <rect x="66" y="58" width="14" height="18" rx="2" fill={a} />
      <circle cx="73" cy="52" r="5" fill={a} />
      <path d="M28 70 l8 -18 l8 18" fill="none" stroke="#fff" strokeWidth="3" />
      <line x1="14" y1="52" x2="24" y2="52" stroke={a} strokeWidth="3" strokeLinecap="round" />
      <line x1="10" y1="40" x2="18" y2="40" stroke={a} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </g>
  ),
  missiles: (a) => (
    <g>
      <line x1="8" y1="84" x2="92" y2="84" stroke="#475569" strokeWidth="3" />
      <rect x="22" y="70" width="10" height="14" fill={a} />
      <rect x="46" y="70" width="10" height="14" fill={a} />
      <rect x="70" y="70" width="10" height="14" fill={a} />
      <line x1="80" y1="16" x2="56" y2="66" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
      <line x1="18" y1="18" x2="36" y2="60" stroke="#f87171" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <circle cx="44" cy="40" r="6" fill="#fff" />
      <circle cx="44" cy="40" r="10" fill="none" stroke={a} strokeWidth="2" opacity="0.5" />
    </g>
  ),
};
