import { Component, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, randomGame } from '../app/registry';
import { GameShell } from '../gameEngine/GameShell';

class GameErrorBoundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state = { err: undefined as Error | undefined };
  static getDerivedStateFromError(err: Error): { err: Error } {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="gv-page" role="alert" id="gv-eb">
          <h2>Game failed to start</h2>
          <p style={{ opacity: 0.85 }}>{this.state.err.message}</p>
          <a href="#/" className="gv-btn gv-primary">
            Back to library
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

export function GamePage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  // /random → pick one now, replace URL with the actual game id.
  useEffect(() => {
    if (params.id === 'random') {
      const def = randomGame();
      navigate(`/play/${def.id}`, { replace: true });
    }
  }, [params.id, navigate]);

  const entry = params.id === 'random' ? undefined : getGame(params.id ?? '');

  if (params.id === 'random') {
    return <ShellFrame title="Picking a game…" label="Picking your random game" />;
  }
  if (!entry) {
    return (
      <div className="gv-404" role="alert">
        <h2>Game not found</h2>
        <p>The game you're looking for doesn't exist in the vault (yet).</p>
        <a href="#/" className="gv-btn gv-primary">
          Back to library
        </a>
      </div>
    );
  }

  return <LoadedGame id={entry.def.id} />;
}

function ShellFrame({ title, label }: { title: string; label: string }) {
  return (
    <div className="gv-shell gv-loading" role="status" aria-label={label}>
      <div className="gv-loading-box">
        <div className="gv-loading-ring" aria-hidden />
        <p className="gv-loading-text">{title}</p>
      </div>
    </div>
  );
}

function LoadedGame({ id }: { id: string }) {
  const entry = getGame(id)!;
  const [Ready, setReady] = useState<React.ComponentType<{ width: number; height: number }> | null>(null);

  useEffect(() => {
    let alive = true;
    setReady(null);
    entry
      .load()
      .then((m) => {
        if (alive) setReady(() => m.default);
      })
      .catch((err) => {
        console.error('Failed to load game', id, err);
      });
    return () => {
      alive = false;
    };
  }, [entry, id]);

  if (!Ready) {
    return <ShellFrame title="Loading…" label={`Loading ${entry.def.name}`} />;
  }

  return (
    <GameErrorBoundary>
      <GameShell def={entry.def} Game={Ready} />
    </GameErrorBoundary>
  );
}
