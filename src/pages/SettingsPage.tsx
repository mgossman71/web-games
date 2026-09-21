import { useStore } from '../app/globalStore';
import { scores } from '../services/storage/scores';
import { allGames } from '../app/registry';

export function SettingsPage() {
  const { visual, setVisual, audioSettings, setAudio, muted, toggleMute } = useStore();

  return (
    <div className="gv-page">
      <header className="gv-page-head">
        <h1>Settings</h1>
        <p className="gv-mut">
          Prefer a lighter load? Reduce particles, turn off screen shake, or switch the CRT filter.
          Everything is saved locally.
        </p>
      </header>

      <section className="gv-panel" aria-label="Audio">
        <h2>Audio</h2>
        <div className="gv-row">
          <label className="gv-row-label">
            <span>Master</span>
            <span className="gv-val">{Math.round(audioSettings.master * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(audioSettings.master * 100)}
            onChange={(e) => setAudio({ master: Number(e.target.value) / 100 })}
            aria-label="Master volume"
          />
        </div>
        <div className="gv-row">
          <label className="gv-row-label">
            <span>Music</span>
            <span className="gv-val">{Math.round(audioSettings.music * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(audioSettings.music * 100)}
            onChange={(e) => setAudio({ music: Number(e.target.value) / 100, musicEnabled: Number(e.target.value) > 0 })}
            aria-label="Music volume"
          />
        </div>
        <div className="gv-row">
          <label className="gv-row-label">
            <span>Effects</span>
            <span className="gv-val">{Math.round(audioSettings.effects * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(audioSettings.effects * 100)}
            onChange={(e) => setAudio({ effects: Number(e.target.value) / 100, effectsEnabled: Number(e.target.value) > 0 })}
            aria-label="Effects volume"
          />
        </div>
        <div className="gv-row gv-row-toggle">
          <span className="gv-row-label">Mute everything</span>
          <Switch
            label={muted ? 'Muted' : 'Unmuted'}
            checked={muted}
            onChange={() => {
              if (!window.confirm?.()) return;
              toggleMute();
            }}
          />
        </div>
      </section>

      <section className="gv-panel" aria-label="Visual and gameplay">
        <h2>Visual & gameplay</h2>
        <div className="gv-row gv-row-toggle">
          <span className="gv-row-label">
            Screen shake
            <small className="gv-mut">Small camera kicks on big events. Off in reduced-motion.</small>
          </span>
          <Switch label={visual.screenShake ? 'On' : 'Off'} checked={visual.screenShake} onChange={(v) => setVisual({ screenShake: v })} />
        </div>
        <div className="gv-row">
          <label className="gv-row-label">
            <span>Particle density</span>
            <span className="gv-val">{Math.round(visual.particleDensity * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={150}
            value={Math.round(visual.particleDensity * 100)}
            onChange={(e) => setVisual({ particleDensity: Number(e.target.value) / 100 })}
            aria-label="Particle density"
          />
        </div>
        <div className="gv-row gv-row-toggle">
          <span className="gv-row-label">
            CRT scanline filter
            <small className="gv-mut">Retro scanlines + subtle vignette over the play field.</small>
          </span>
          <Switch label={visual.crt ? 'On' : 'Off'} checked={visual.crt} onChange={(v) => setVisual({ crt: v })} />
        </div>
        <div className="gv-row gv-row-toggle">
          <span className="gv-row-label">
            Reduced motion
            <small className="gv-mut">Disables non-essential animations across the app.</small>
          </span>
          <Switch
            label={visual.reducedMotion ? 'On' : 'Off'}
            checked={visual.reducedMotion}
            onChange={(v) => setVisual({ reducedMotion: v, screenShake: v ? false : visual.screenShake })}
          />
        </div>
        <div className="gv-row gv-row-toggle">
          <span className="gv-row-label">
            Gamepad vibration
            <small className="gv-mut">Bumps when a gamepad is connected.</small>
          </span>
          <Switch label={visual.gamepadVibration ? 'On' : 'Off'} checked={visual.gamepadVibration} onChange={(v) => setVisual({ gamepadVibration: v })} />
        </div>
      </section>

      <section className="gv-panel" aria-label="Local data">
        <h2>Local data</h2>
        <p className="gv-mut">
          Scores, stats, and settings are stored in your browser. Nothing ever leaves this machine.
        </p>
        <p className="gv-mut">
          Playing games across {allGames().length} titles · top {scores.getBest('neon-snake') > 0 ? 'bests recorded' : 'session fresh'}
        </p>
        <div className="gv-row">
          <button
            type="button"
            className="gv-btn gv-danger"
            onClick={() => {
              if (window.confirm('Reset ALL local data (scores, stats, achievements)?')) {
                try {
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith('gv.'))
                    .forEach((k) => localStorage.removeItem(k));
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }
            }}
          >
            Reset all local data
          </button>
        </div>
      </section>
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`gv-switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="gv-switch-knob" />
    </button>
  );
}
