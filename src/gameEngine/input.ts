import type { GameAction } from '../types';

export interface InputHandlers {
  onAction: (action: GameAction, down: boolean) => void;
  onAxis: (axis: 'x' | 'y', value: number) => void;
}

export interface InputOptions {
  /** Keys to preventDefault on keydown (e.g. arrows/space to stop page scroll). */
  preventDefaultKeys?: string[];
  /** Actions the game does not consume (so they bubble to the shell, e.g. pause). */
  ignoreActions?: GameAction[];
}

/**
 * Shared input manager: keyboard + touch(virtual) + gamepad merged together.
 * Emits an action edge (down=true once on press, down=false on the last
 * release) even when the same action is held by multiple sources.
 *
 * Keyboard: arrows/WASD move, Space=jump, Z/J/K?=fire, X=secondary,
 *          Enter=confirm, Esc=cancel, P=pause.
 * Gamepad: A/1=confirm+jump, B/2=cancel, X/3=fire, Y/4=secondary,
 *          Start=menu/pause, D-pad 12-15 move, stick axes 0/1.
 * Touch:   GameShell virtual buttons call setVirtual().
 */
export class InputManager {
  private handlers: InputHandlers;
  private opts: InputOptions;
  /** Game-level subscribers (games add their own listeners via subscribe()). */
  private subs = new Set<(action: GameAction, down: boolean) => void>();

  private sources = [
    new Set<GameAction>(), // keyboard
    new Set<GameAction>(), // virtual/touch
    new Set<GameAction>(), // gamepad
  ];

  private axes: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  private padPrevButtons: boolean[] = [];
  private padPrevStick = { x: 0, y: 0 };
  private padAttached = false;

  private onKeyDown = (e: KeyboardEvent) => this.keyEvent(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.keyEvent(e, false);
  private onPadEvent = () => this.resetPad();
  private padTimer: ReturnType<typeof setInterval> | null = null;

  private attached = false;
  private disabled = false;

  constructor(handlers: InputHandlers, opts: InputOptions = {}) {
    this.handlers = handlers;
    this.opts = opts;
  }

  attach(target: EventTarget = window): void {
    if (this.attached) return;
    this.attached = true;
    target.addEventListener('keydown', this.onKeyDown as EventListener, { passive: false });
    target.addEventListener('keyup', this.onKeyUp as EventListener, { passive: true });
    if (typeof navigator !== 'undefined' && 'gamepad' in navigator) {
      window.addEventListener('gamepadconnected', this.onPadEvent);
      window.addEventListener('gamepaddisconnected', this.onPadEvent);
      this.padTimer = setInterval(() => this.pollPad(), 30);
    }
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('gamepadconnected', this.onPadEvent);
    window.removeEventListener('gamepaddisconnected', this.onPadEvent);
    if (this.padTimer) {
      clearInterval(this.padTimer);
      this.padTimer = null;
    }
    for (let i = 0; i < this.sources.length; i++) {
      for (const a of this.sources[i]) this.emit(a, false);
      this.sources[i].clear();
    }
    this.axes = { x: 0, y: 0, active: false };
    this.handlers.onAxis('x', 0);
    this.handlers.onAxis('y', 0);
  }

  /** Freezes all input (pause overlays, menu screens). */
  setDisabled(d: boolean): void {
    this.disabled = d;
    if (d) {
      for (let i = 0; i < this.sources.length; i++) {
        for (const a of this.sources[i]) this.emit(a, false);
        this.sources[i].clear();
      }
      this.handlers.onAxis('x', 0);
      this.handlers.onAxis('y', 0);
    }
  }

  isHeld(action: GameAction): boolean {
    for (const s of this.sources) if (s.has(action)) return true;
    return false;
  }

  getAxisX(): number {
    if (this.axes.active) return this.axes.x;
    return (this.isHeld('moveRight') ? 1 : 0) - (this.isHeld('moveLeft') ? 1 : 0);
  }

  getAxisY(): number {
    if (this.axes.active) return this.axes.y;
    return (this.isHeld('moveDown') ? 1 : 0) - (this.isHeld('moveUp') ? 1 : 0);
  }

  /** Touch / virtual buttons. */
  setVirtual(action: GameAction, down: boolean): void {
    this.set(1, action, down);
  }

  // --------------------------------------------------------------- internals

  /**
   * Subscribe an extra listener for every emitted action edge.
   * Games call this to react to normalized actions; the shell keeps its own
   * handler for pause/confirm. Returns an unsubscribe fn.
   */
  subscribe(listener: (action: GameAction, down: boolean) => void): () => void {
    this.subs.add(listener);
    return () => {
      this.subs.delete(listener);
    };
  }

  private static readonly KEY_MAP: Record<string, GameAction> = {
    ArrowLeft: 'moveLeft', a: 'moveLeft', A: 'moveLeft', q: 'moveLeft', Q: 'moveLeft',
    ArrowRight: 'moveRight', d: 'moveRight', D: 'moveRight', e: 'moveRight', E: 'moveRight',
    ArrowUp: 'moveUp', w: 'moveUp', W: 'moveUp', r: 'moveUp', R: 'moveUp',
    ArrowDown: 'moveDown', s: 'moveDown', S: 'moveDown', f: 'moveDown', F: 'moveDown',
    ' ': 'jump',
    z: 'fire', Z: 'fire', j: 'fire', J: 'fire',
    x: 'secondary', X: 'secondary', c: 'secondary', C: 'secondary',
    Enter: 'confirm',
    Escape: 'cancel',
    p: 'pause', P: 'pause',
    m: 'menu', M: 'menu',
  };

  private keyEvent(e: KeyboardEvent, down: boolean): void {
    if (this.disabled || e.repeat && down) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const action = InputManager.KEY_MAP[e.key];
    if (!action) return;
    if (down && this.opts.preventDefaultKeys?.includes(e.key)) e.preventDefault();
    this.set(0, action, down);
  }

  private set(sourceIdx: number, action: GameAction, down: boolean): void {
    if (this.opts.ignoreActions?.includes(action)) return;
    const src = this.sources[sourceIdx];
    const wasHeld = this.isHeld(action);
    if (down) {
      if (wasHeld) return;
      src.add(action);
      this.emit(action, true);
    } else {
      if (!src.has(action)) return;
      src.delete(action);
      if (!this.isHeld(action)) this.emit(action, false);
    }
  }

  private emit(action: GameAction, down: boolean): void {
    try {
      this.handlers.onAction(action, down);
    } catch {
      /* a broken handler must never break the game loop */
    }
    this.subs.forEach((f) => {
      try {
        f(action, down);
      } catch {
        /* ignore */
      }
    });
  }

  private static readonly PAD_ACTIONS: { index: number; actions: GameAction[] }[] = [
    { index: 0, actions: ['confirm', 'jump'] },
    { index: 1, actions: ['cancel'] },
    { index: 2, actions: ['fire'] },
    { index: 3, actions: ['secondary'] },
    { index: 7, actions: ['fire'] }, // right stick click
    { index: 9, actions: ['pause', 'menu'] },
    { index: 12, actions: ['moveUp'] },
    { index: 13, actions: ['moveDown'] },
    { index: 14, actions: ['moveLeft'] },
    { index: 15, actions: ['moveRight'] },
  ];

  private resetPad(): void {
    this.padPrevButtons = [];
    this.set(2, 'confirm', false);
    this.set(2, 'jump', false);
    this.set(2, 'cancel', false);
    this.set(2, 'fire', false);
    this.set(2, 'secondary', false);
    this.set(2, 'pause', false);
    this.set(2, 'menu', false);
    this.set(2, 'moveUp', false);
    this.set(2, 'moveDown', false);
    this.set(2, 'moveLeft', false);
    this.set(2, 'moveRight', false);
    this.padAttached = false;
    if (this.axes.active || this.padPrevStick.x !== 0 || this.padPrevStick.y !== 0) {
      this.axes = { x: 0, y: 0, active: false };
      this.handlers.onAxis('x', 0);
      this.handlers.onAxis('y', 0);
    }
    this.padPrevStick = { x: 0, y: 0 };
  }

  private pollPad(): void {
    if (this.disabled || this.attached === false) return;
    if (typeof navigator === 'undefined' || 'getGamepads' in navigator === false) return;
    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) {
      if (this.padAttached) this.resetPad();
      return;
    }
    if (!this.padAttached) {
      this.padAttached = true;
      this.padPrevButtons = [];
    }
    const buttons = pad.buttons.map((b) => b.pressed);
    for (const { index, actions } of InputManager.PAD_ACTIONS) {
      const pressed = buttons[index] ?? false;
      const was = this.padPrevButtons[index] ?? false;
      if (pressed === was) continue;
      for (const a of actions) this.set(2, a, pressed);
    }
    this.padPrevButtons = buttons;

    const dead = (v: number): number => (Math.abs(v) < 0.22 ? 0 : Math.abs(v) < 0.4 ? v * 0.5 : v);
    const ax = dead(pad.axes[0] ?? 0);
    const ay = dead(pad.axes[1] ?? 0);
    if (ax !== this.padPrevStick.x || ay !== this.padPrevStick.y) {
      this.padPrevStick = { x: ax, y: ay };
      this.axes = { x: ax, y: ay, active: ax !== 0 || ay !== 0 };
      this.handlers.onAxis('x', ax);
      this.handlers.onAxis('y', ay);
    }
  }
}

/** True when a gamepad appears connected right now. */
export function gamepadConnected(): boolean {
  if (typeof navigator === 'undefined') return false;
  const pads = navigator.getGamepads?.();
  return !!pads && pads.some((p) => p && p.connected);
}
