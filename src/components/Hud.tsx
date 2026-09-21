export interface HudState {
  score: number;
  best: number;
  level: number;
  lives: number;
  /** Already-formatted secondary label ("LAP 2/3", "1:23.4", "MOVES 14"). */
  timeLabel: string | null;
}

interface Props {
  hud: HudState;
  showsLives: boolean;
  bestLabel?: string;
}

export function Hud({ hud, showsLives, bestLabel = 'BEST' }: Props) {
  return (
    <div className="gv-hud" role="status" aria-live="off">
      <div className="gv-hud-cell">
        <span className="gv-hud-label">SCORE</span>
        <span className="gv-hud-value">{hud.score.toLocaleString()}</span>
      </div>
      <div className="gv-hud-cell">
        <span className="gv-hud-label">{bestLabel}</span>
        <span className="gv-hud-value">{hud.best.toLocaleString()}</span>
      </div>
      {hud.level > 0 && (
        <div className="gv-hud-cell">
          <span className="gv-hud-label">WAVE</span>
          <span className="gv-hud-value">{hud.level}</span>
        </div>
      )}
      {showsLives && hud.lives > 0 && (
        <div className="gv-hud-cell" aria-label={`${hud.lives} lives`}>
          <span className="gv-hud-label">LIVES</span>
          <span className="gv-hud-value gv-lives">
            {Array.from({ length: Math.min(hud.lives, 5) }).map((_, i) => (
              <span key={i} className="gv-life-pip" aria-hidden />
            ))}
            {hud.lives > 5 ? <span className="gv-life-extra">×{hud.lives}</span> : null}
          </span>
        </div>
      )}
      {hud.timeLabel && (
        <div className="gv-hud-cell">
          <span className="gv-hud-label">TIME</span>
          <span className="gv-hud-value">{hud.timeLabel}</span>
        </div>
      )}
    </div>
  );
}
