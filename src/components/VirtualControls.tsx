import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction } from '../types';

interface Props {
  actions: GameAction[]; // which virtual buttons to render
  onAction: (action: GameAction, down: boolean) => void;
  visible: boolean;
}

interface PadButton {
  action: GameAction;
  label: string;
  cls: string;
}

const LABELS: Record<string, string> = {
  moveLeft: '◀',
  moveRight: '▶',
  moveUp: '▲',
  moveDown: '▼',
  jump: 'A',
  fire: 'X',
  secondary: 'Y',
  confirm: 'OK',
};

/**
 * Virtual touch buttons. Renders only the actions a game asked for.
 * Uses pointer events + CSS `touch-action: none` so drags never scroll.
 */
export function VirtualControls({ actions, onAction, visible }: Props) {
  if (!visible) return null;
  const buttons = actions.map<PadButton>((a) => ({ action: a, label: LABELS[a] ?? a, cls: `gv-pad gv-pad-${a}` }));
  const movement = buttons.filter((b) => b.action.startsWith('move'));
  const others = buttons.filter((b) => !b.action.startsWith('move'));

  return (
    <div className="gv-virtual" role="group" aria-label="Touch controls">
      {movement.length > 0 && (
        <div className="gv-dpad">
          {movement.map((b) => (
            <PadBtn key={b.action} {...b} onAction={onAction} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="gv-act">
          {others.map((b) => (
            <PadBtn key={b.action} {...b} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  );
}

interface BtnProps {
  action: GameAction;
  label: string;
  onAction: (a: GameAction, down: boolean) => void;
}

function PadBtn({ action, label, onAction }: BtnProps) {
  const [pressed, setPressed] = useState(false);
  const pointerIds = useRef(new Set<number>());

  const down = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      pointerIds.current.add(e.pointerId);
      setPressed(true);
      onAction(action, true);
    },
    [action, onAction],
  );

  const up = useCallback(
    (e: React.PointerEvent) => {
      pointerIds.current.delete(e.pointerId);
      if (pointerIds.current.size === 0) {
        setPressed(false);
        onAction(action, false);
      }
    },
    [action, onAction],
  );

  useEffect(() => {
    if (pressed && pointerIds.current.size === 0) setPressed(false);
  }, [pressed]);

  return (
    <button
      type="button"
      className={`gv-padbtn ${pressed ? 'is-down' : ''}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      aria-label={action}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span aria-hidden>{label}</span>
    </button>
  );
}
