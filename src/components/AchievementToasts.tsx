import { Link } from 'react-router-dom';
import { achievementLabel } from '../hooks/useAchievementToasts';

export interface ToastItem {
  key: number;
  id: string;
  at: number;
}

interface Props {
  toasts: ToastItem[];
  dismiss: (key: number) => void;
}

export function AchievementToasts({ toasts, dismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="gv-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const def = achievementLabel(t.id);
        if (!def) return null;
        return (
          <div key={t.key} className="gv-toast" role="status">
            <span className="gv-toast-icon" aria-hidden>
              {def.icon}
            </span>
            <div className="gv-toast-body">
              <span className="gv-toast-kicker">ACHIEVEMENT UNLOCKED</span>
              <span className="gv-toast-title">{def.title}</span>
              <span className="gv-toast-desc">{def.description}</span>
            </div>
            <button type="button" className="gv-toast-x" onClick={() => dismiss(t.key)} aria-label="Dismiss">
              ×
            </button>
          </div>
        );
      })}
      <p className="gv-toast-foot">
        View all in <Link to="/achievements">Achievements</Link>
      </p>
    </div>
  );
}
