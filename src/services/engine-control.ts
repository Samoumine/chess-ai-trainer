import { game } from "../lib/chess";
import { engine } from "./engine-singleton";

type Listener = () => void;

let engineOn = false;
let engineSide: "w" | "b" = "b"; // default: engine plays Black
const listeners = new Set<Listener>();
let wiredBestmove = false;

function emit() { for (const fn of listeners) fn(); }

export function getEngineOn() { return engineOn; }
export function getEngineSide() { return engineSide; }
export function subscribeEngineCtl(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

export async function turnEngineOn() {
  if (engineOn) return;
  engineOn = true; emit();
  await engine.start();
  engine.send("uci");
  engine.send("isready");
  engine.send("ucinewgame");
  ensureEngineBestmoveApplied();
  requestEngineMove();
}

export function turnEngineOff() {
  if (!engineOn) return;
  engineOn = false; emit();
  engine.send("stop");
  engine.stop();
}

export function setEnginePlays(side: "w" | "b") {
  engineSide = side; emit();
  requestEngineMove();
}

export function ensureEngineBestmoveApplied() {
  if (wiredBestmove) return;
  wiredBestmove = true;
  engine.onMessage((line) => {
    if (!line.startsWith("bestmove ")) return;
    const uci = line.slice(9).trim();
    if (!uci || uci === "(none)") return;
    if (game.isGameOver()) return;
    game.moveUci(uci);
  });
}

export function requestEngineMove(): boolean {
  if (!engineOn) return false;
  if (game.isGameOver()) return false;
  if (game.turn() !== engineSide) return false;

  const moves = game.historyUci();
  const posCmd = `position startpos${moves.length ? " moves " + moves.join(" ") : ""}`;
  engine.send(posCmd);
  engine.send("go movetime 800");
  return true;
}
