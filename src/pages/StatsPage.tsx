import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { stats } from '../services/storage/stats';
import { scores } from '../services/storage/scores';
import { allGames, getGame } from '../app/registry';
import { ACHIEVEMENTS, achievements } from '../services/storage/achievements';
import { formatSeconds } from '../utils/math';

export function StatsPage() {
  const data = useMemo(() => stats.get(), []);
  const games = useMemo(() => allGames(), []);

  const favoriteId = useMemo(() => stats.favoriteGame(), []);
  const favorite = favoriteId ? getGame(favoriteId)?.def : undefined;

  const ranked = useMemo(
    () =>
      games
        .map((g) => ({ def: g, best: scores.getBest(g.id) }))
        .sort((a, b) => b.best - a.best),
    [games],
  );

  return (
    <div className="gv-page">
      <header className="gv-page-head">
        <h1>Player Stats</h1>
        <p className="gv-mut">Everything is stored locally in your browser.</p>
      </header>

      <section className="gv-stat-grid" aria-label="Summary">
        <StatCard label="Games played" value={data.gamesPlayed.toLocaleString()} sub="sessions, all games" />
        <StatCard
          label="Total play time"
          value={formatSeconds(Math.round(data.totalPlayTimeMs / 1000))}
          sub="cumulative"
        />
        <StatCard
          label="Longest session"
          value={formatSeconds(Math.round(data.longestSessionMs / 1000))}
          sub="single run"
        />
        <StatCard label="Completed games" value={data.gamesCompleted.toLocaleString()} sub="win conditions met" />
        <StatCard
          label="Favorite game"
          value={favorite?.name ?? '—'}
          sub={favorite ? `${data.gameSessions[favorite.id] ?? 0} sessions` : 'play a game to set one'}
          small
        />
        <StatCard
          label="Achievements"
          value={`${achievements.unlockedList().length}/${ACHIEVEMENTS.length}`}
          sub={
            <Link to="/achievements" className="gv-link">
              view the wall →
            </Link>
          }
        />
      </section>

      <section className="gv-panel" aria-label="High scores by game">
        <h2>High scores</h2>
        <ol className="gv-scorelist">
          {ranked.map((r, i) => (
            <li key={r.def.id} className="gv-score-row">
              <span className="gv-score-rank">{i + 1}</span>
              <span className="gv-score-dot" style={{ background: r.def.accent }} aria-hidden />
              <span className="gv-score-name">
                <Link to={`/play/${r.def.id}`}>{r.def.name}</Link>
              </span>
              <span className="gv-score-val">{r.best > 0 ? r.best.toLocaleString() : '—'}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  small,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className={`gv-stat ${small ? 'gv-stat-small' : ''}`}>
      <span className="gv-stat-label">{label}</span>
      <span className="gv-stat-value">{value}</span>
      {sub && <span className="gv-stat-sub">{sub}</span>}
    </div>
  );
}
