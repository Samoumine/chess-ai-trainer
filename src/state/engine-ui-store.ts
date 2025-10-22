/**
 * Engine UI Store
 * ----------------
 * Holds the user's selections (engine type, difficulty, side), and provides
 * small helpers to apply those selections to the runtime engineRegistry.
 *
 */

import type { Difficulty, EngineKind } from "../engine/types";
import { engineRegistry } from "../services/engine-registry";

type EngineSide = "off" | "white" | "black";

type Listener = () => void;

const state = {
  engineKind: "stockfish" as EngineKind,
  difficulty: "intermediate" as Difficulty,
  side: "off" as EngineSide,
  moveTimeMs: undefined as number | undefined,
};

const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((fn) => fn());
}

export const engineUI = {
  // --- getters ---------------------------------------------------------------
  get engineKind() { return state.engineKind; },
  get difficulty() { return state.difficulty; },
  get side() { return state.side; },
  get moveTimeMs() { return state.moveTimeMs; },

  // --- subscribe/unsubscribe for React components ---------------------------
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // --- mutations + side-effects (apply to engineRegistry) -------------------
  async setEngineKind(kind: EngineKind) {
    state.engineKind = kind;
    // (Re)initialize the engine instance with current options
    await engineRegistry.use(kind, {
      difficulty: state.difficulty,
      moveTimeMs: state.moveTimeMs,
    });
    notify();
  },

  async setDifficulty(d: Difficulty) {
    state.difficulty = d;
    await engineRegistry.setOptions({
      difficulty: d,
      moveTimeMs: state.moveTimeMs,
    });
    notify();
  },

  setSide(s: EngineSide) {
    state.side = s;
    notify();
  },

  async setMoveTime(ms?: number) {
    state.moveTimeMs = ms;
    await engineRegistry.setOptions({
      difficulty: state.difficulty,
      moveTimeMs: state.moveTimeMs,
    });
    notify();
  },
};
