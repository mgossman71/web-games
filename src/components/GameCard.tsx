import { Link } from 'react-router-dom';
import type { GameDefinition } from '../types';
import { GameArt } from './GameArt';
import { scores } from '../services/storage/scores';

interface Props {
  def: GameDefinition;
  index: number;
}

const inputGlyphs: Record<string, string> = {
  keyboard: '⌨',
  mouse: '🖱',
  touch: '👆',
  gamepad: '🎮',
};

export function GameCard({ def, index }: Props) {
  const best = scores.getBest(def.id);
  return (
    <article
      className="gv-card"
      style={{ ['--accent' as string]: def.accent, animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div className="gv-card-art">
        <GameArt artId={def.artId} accent={def.accent} size={92} />
        <span className="gv-card-genre">{def.genre}</span>
      </div>
      <div className="gv-card-body">
        <h3 className="gv-card-name">{def.name}</h3>
        <p className="gv-card-desc">{def.short}</p>
        <div className="gv-card-meta">
          <span className="gv-pill gv-pill-diff" data-diff={def.difficulty}>
            {def.difficulty}
          </span>
          <span className="gv-pill">
            {def.players === 2 ? '1–2P' : '1P'}
          </span>
          <span className="gv-pill gv-pill-inputs" title={def.supportedInputs.join(', ')}>
            {def.supportedInputs.map((i) => inputGlyphs[i]).join(' ')}
          </span>
        </div>
        <div className="gv-card-foot">
          <span className="gv-best">{best > 0 ? `Best ${best.toLocaleString()}` : 'Not played yet'}</span>
          <Link to={`/play/${def.id}`} className="gv-btn gv-primary gv-play" aria-label={`Play ${def.name}`}>
            ▶ Play
          </Link>
        </div>
      </div>
    </article>
  );
}
