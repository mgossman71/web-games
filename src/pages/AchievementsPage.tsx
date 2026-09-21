import { useMemo } from 'react';
import { ACHIEVEMENTS, achievements } from '../services/storage/achievements';

export function AchievementsPage() {
  const unlocked = useMemo(() => {
    const map = new Map<string, number>();
    achievements.unlockedList().forEach((e) => map.set(e.id, e.at));
    return map;
  }, []);

  const sorted = useMemo(
    () => [...ACHIEVEMENTS].sort((a, b) => (unlocked.has(b.id) ? 1 : 0) - (unlocked.has(a.id) ? 1 : 0)),
    [unlocked],
  );

  const count = unlocked.size;

  return (
    <div className="gv-page">
      <header className="gv-page-head">
        <h1>Achievements</h1>
        <p className="gv-mut">
          {count === 0
            ? 'None unlocked yet — the vault is waiting.'
            : `${count} of ${ACHIEVEMENTS.length} unlocked. Keep playing.`}
        </p>
      </header>

      <ol className="gv-achlist" aria-label="Achievements">
        {sorted.map((a) => {
          const at = unlocked.get(a.id);
          return (
            <li key={a.id} className={`gv-ach ${at ? 'is-unlocked' : ''}`} data-accent={at ? '#22d3ee' : undefined}>
              <span className="gv-ach-icon" aria-hidden>
                {at ? a.icon : '🔒'}
              </span>
              <div className="gv-ach-body">
                <h3>{a.title}</h3>
                <p>{a.description}</p>
              </div>
              <span className="gv-ach-state">{at ? 'Unlocked' : 'Locked'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
