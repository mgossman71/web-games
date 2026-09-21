import { useMemo, useState } from 'react';
import { allGames } from '../app/registry';
import { GameCard } from '../components/GameCard';
import { getDailyChallenge, challengeCompletedKey } from '../services/dailyChallenge';
import { stats } from '../services/storage/stats';
import { Link } from 'react-router-dom';

const GENRES = ['All', 'Arcade', 'Puzzle', 'Strategy', 'Racing', 'Action', 'Board', 'Casual'] as const;

export function HomePage() {
  const games = useMemo(() => allGames(), []);
  const [genre, setGenre] = useState<(typeof GENRES)[number]>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (genre !== 'All' && g.genre !== genre) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.short.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.tags.some((t) => t.includes(q))
      );
    });
  }, [games, genre, query]);

  const statsNow = useMemo(() => {
    const s = stats.get();
    return {
      count: games.length,
      bestTotal: Object.values(s.highScores).reduce((a, b) => a + b, 0),
      played: s.gamesPlayed,
    };
  }, [games]);

  const daily = useMemo(() => getDailyChallenge(), []);
  const dailyDone = useMemo(() => {
    try {
      return localStorage.getItem(challengeCompletedKey()) === '1';
    } catch {
      return false;
    }
  }, []);

  return (
    <div className="gv-home">
      <section className="gv-hero" aria-label="Game Vault hero">
        <div className="gv-hero-inner">
          <p className="gv-hero-kicker">A MODERN DIGITAL ARCADE</p>
          <h1 className="gv-hero-title">
            GAME <span className="gv-accent-grad">VAULT</span>
          </h1>
          <p className="gv-hero-sub">Pick a game. Press play.</p>
          <div className="gv-hero-cta">
            <a href={`#/random`} className="gv-btn gv-primary gv-cta">
              ▶ PLAY RANDOM GAME
            </a>
            <a href={`#/play/neon-snake`} className="gv-btn">
              Start a session →
            </a>
          </div>
          <div className="gv-hero-stats" aria-label="Collection stats">
            <div className="gv-hstat">
              <span className="gv-hstat-n">{statsNow.count}</span>
              <span className="gv-hstat-l">games</span>
            </div>
            <div className="gv-hstat">
              <span className="gv-hstat-n">{statsNow.played}</span>
              <span className="gv-hstat-l">sessions</span>
            </div>
            <div className="gv-hstat">
              <span className="gv-hstat-n">{statsNow.bestTotal > 0 ? statsNow.bestTotal.toLocaleString() : '—'}</span>
              <span className="gv-hstat-l">top scores</span>
            </div>
          </div>
        </div>
        <div className="gv-hero-orbs" aria-hidden>
          <span className="gv-orb gv-orb-a" />
          <span className="gv-orb gv-orb-b" />
          <span className="gv-orb gv-orb-c" />
        </div>
      </section>

      <section className="gv-daily" aria-label="Daily challenge" data-done={dailyDone}>
        <span className="gv-daily-tick" aria-hidden>
          {dailyDone ? '✓' : '◷'}
        </span>
        <div>
          <span className="gv-daily-kicker">DAILY CHALLENGE · {new Date().toLocaleDateString()}</span>
          <h3>{daily.title}</h3>
          <p>{daily.description}</p>
        </div>
        <Link to={`/play/${daily.gameId}`} className="gv-btn gv-primary gv-daily-cta">
          Accept
        </Link>
      </section>

      <section className="gv-library" aria-label="Game library">
        <div className="gv-library-head">
          <h2>Game Library</h2>
          <div className="gv-filters" role="group" aria-label="Filter by genre">
            {GENRES.map((g) => (
              <button
                key={g}
                type="button"
                className={`gv-fchip ${genre === g ? 'is-on' : ''}`}
                aria-pressed={genre === g}
                onClick={() => setGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="gv-search">
            <label className="visually-hidden" htmlFor="gv-search-input">
              Search games
            </label>
            <input
              id="gv-search-input"
              type="search"
              placeholder="Search games…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="gv-empty">
            <h3>No games match that yet.</h3>
            <p>
              Clear your search or genre filter — the vault has {games.length} original games inside.
            </p>
            <button
              type="button"
              className="gv-btn"
              onClick={() => {
                setQuery('');
                setGenre('All');
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="gv-grid">
            {filtered.map((def, i) => (
              <GameCard key={def.id} def={def} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
