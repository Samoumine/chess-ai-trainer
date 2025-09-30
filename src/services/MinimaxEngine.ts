import { Chess, Move } from "chess.js";
import type { IEngine, UciListener } from "./Engine";

/**
 * Lightweight engine implementing a tiny UCI subset:
 * - uci            -> prints "uciok"
 * - isready        -> prints "readyok"
 * - ucinewgame     -> resets internal state
 * - position ...   -> set FEN or startpos + moves
 * - go movetime X  -> search for X ms and print "bestmove ..."
 * - stop, quit     -> stop search
 * Optional: setoption name Skill Level value N (0..20) -> scales depth
 */
export class MinimaxEngine implements IEngine {
  private listeners: UciListener[] = [];
  private chess = new Chess();
  private stopFlag = false;
  private skill = 5;           // 0..20
  private defaultMs = 800;     // fallback movetime

  async start(): Promise<void> {
    // nothing to init
  }

  onMessage(cb: UciListener): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(fn => fn !== cb);
    };
  }
  private emit(line: string) { this.listeners.forEach(fn => fn(line)); }

  stop(): void { this.stopFlag = true; }

  send(cmd: string): void {
    const [head, ...rest] = cmd.trim().split(/\s+/);
    switch ((head || "").toLowerCase()) {
      case "uci":
        this.emit("id name MiniNegamax 0.1");
        this.emit("id author You");
        this.emit("uciok");
        break;
      case "isready":
        this.emit("readyok");
        break;
      case "ucinewgame":
        this.chess.reset();
        break;
      case "setoption":
        this.handleSetOption(rest);
        break;
      case "position":
        this.handlePosition(rest);
        break;
      case "go":
        this.handleGo(rest);
        break;
      case "stop":
        this.stop();
        break;
      case "quit":
        this.stop();
        break;
      default:
        // ignore
        break;
    }
  }

  private handleSetOption(tokens: string[]) {
    // setoption name Skill Level value 10
    const idxName = tokens.findIndex(t => t.toLowerCase() === "name");
    const idxVal = tokens.findIndex(t => t.toLowerCase() === "value");
    const name = idxName >= 0 ? tokens.slice(idxName + 1, idxVal >= 0 ? idxVal : undefined).join(" ") : "";
    if (name.toLowerCase() === "skill level" && idxVal >= 0) {
      const n = parseInt(tokens[idxVal + 1] || "5", 10);
      if (!Number.isNaN(n)) this.skill = Math.max(0, Math.min(20, n));
    }
  }

  private handlePosition(tokens: string[]) {
    // position startpos [moves ...]
    // position fen <FEN...> [moves ...]
    let i = 0;
    if (tokens[i] === "startpos") {
      this.chess.reset();
      i++;
    } else if (tokens[i] === "fen") {
      const fen = tokens.slice(i + 1).join(" ");
      const cut = fen.indexOf(" moves ");
      const fenStr = cut >= 0 ? fen.slice(0, cut) : fen;
      this.chess.load(fenStr.trim());
      // moves handled below if present
    }
    const movesIdx = tokens.indexOf("moves");
    if (movesIdx >= 0) {
      const moves = tokens.slice(movesIdx + 1);
      for (const uci of moves) this.tryMoveUci(uci);
    }
  }

  private tryMoveUci(uci: string): boolean {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;
    try {
      const mv = this.chess.move({ from, to, promotion } as any);
      return !!mv;
    } catch {
      return false;
    }
  }

  private handleGo(tokens: string[]) {
    let ms = this.defaultMs;
    const mt = tokens.indexOf("movetime");
    if (mt >= 0) {
      const v = parseInt(tokens[mt + 1] || `${ms}`, 10);
      if (!Number.isNaN(v)) ms = Math.max(50, v);
    }
    this.searchTimed(ms);
  }

  // ----------------- Search -----------------

  private pieceVal(p: string): number {
    switch (p.toLowerCase()) {
      case "p": return 100;
      case "n": return 320;
      case "b": return 330;
      case "r": return 500;
      case "q": return 900;
      case "k": return 0;
      default: return 0;
    }
  }

  // simple piece-square bonuses for development; white perspective; black mirrored
  private pst: Record<string, number[]> = {
    p: [
      0, 5, 5, -10, -10, 5, 5, 0,
      0, 10, -5, 0, 0, -5, 10, 0,
      0, 10, 10, 20, 20, 10, 10, 0,
      5, 20, 20, 30, 30, 20, 20, 5,
      5, 15, 15, 25, 25, 15, 15, 5,
      0, 10, 10, 20, 20, 10, 10, 0,
      5, 5, 10, -20, -20, 10, 5, 5,
      0, 0, 0, 0, 0, 0, 0, 0,
    ],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50,
    ],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20,
    ],
    r: [
      0, 0, 0, 5, 5, 0, 0, 0,
      - 5, 0, 0, 0, 0, 0, 0, - 5,
      - 5, 0, 0, 0, 0, 0, 0, - 5,
      - 5, 0, 0, 0, 0, 0, 0, - 5,
      - 5, 0, 0, 0, 0, 0, 0, - 5,
      - 5, 0, 0, 0, 0, 0, 0, - 5,
      5, 10, 10, 10, 10, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0,
    ],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20,
    ],
    k: Array(64).fill(0),
  };

  private evaluate(): number {
    // positive = white better; negate for side-to-move in negamax
    let score = 0;
    const board = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (!sq) continue;
        const base = this.pieceVal(sq.type);
        const idx = (sq.color === "w") ? (r * 8 + c) : ((7 - r) * 8 + (7 - c));
        const pst = this.pst[sq.type]?.[idx] ?? 0;
        const val = base + pst;
        score += sq.color === "w" ? val : -val;
      }
    }
    return score;
  }

  private nodes = 0;

  private negamax(depth: number, alpha: number, beta: number): { score: number; move?: Move } {
    if (this.stopFlag) return { score: 0 };
    this.nodes++;

    if (depth === 0 || this.chess.isGameOver()) {
      const s = this.evaluate();
      // Negamax convention: score is from side-to-move perspective
      return { score: this.chess.turn() === "w" ? s : -s };
    }

    let bestMove: Move | undefined;
    let a = alpha;

    // Simple move ordering: captures first
    const moves = this.chess.moves({ verbose: true }) as Move[];
    moves.sort((m) => (m.flags.includes("c") ? -1 : 1));

    for (const m of moves) {
      this.chess.move(m);
      const { score } = this.negamax(depth - 1, -beta, -a);
      this.chess.undo();
      const val = -score;
      if (val > a) {
        a = val;
        bestMove = m;
        if (a >= beta) break; // alpha-beta cutoff
      }
    }

    return { score: a, move: bestMove };
  }

  private async searchTimed(ms: number) {
    this.stopFlag = false;
    // Map "skill" to depth (very rough): 0..20 -> 1..5
    const maxDepth = 1 + Math.floor(this.skill / 5); // 1..5
    const endAt = performance.now() + ms;
    let best: Move | undefined;
    let lastScore = 0;

    for (let d = 1; d <= maxDepth; d++) {
      if (this.stopFlag) break;
      this.nodes = 0;
      const { score, move } = this.negamax(d, -10_000_000, 10_000_000);
      if (this.stopFlag) break;
      if (move) { best = move; lastScore = score; }
      if (performance.now() > endAt) break;
    }

    const bestmove = best ? (best.from + best.to + (best.promotion ?? "")) : this.pickFallbackMove();
    // informational line (optional)
    this.emit(`info depth ${Math.min(maxDepth, best ? maxDepth : 1)} nodes ${this.nodes} score cp ${lastScore}`);
    this.emit(`bestmove ${bestmove}`);
  }

  private pickFallbackMove(): string {
    const moves = this.chess.moves({ verbose: true }) as Move[];
    if (!moves.length) return "(none)";
    const m = moves[Math.floor(Math.random() * moves.length)];
    return m.from + m.to + (m.promotion ?? "");
  }
}
