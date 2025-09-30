import { Chess, Move, Square } from "chess.js";

class Game {
  private chess = new Chess();
  private listeners = new Set<() => void>();
  private _lastMove?: Move;

  private emit() { for (const fn of this.listeners) fn(); }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };


  reset() {
    this.chess = new Chess(); this._lastMove = undefined;
    this.emit();
  }
  fen() { return this.chess.fen(); }
  turn(): "w" | "b" { return this.chess.turn(); }
  isGameOver() { return this.chess.isGameOver(); }
  isCheck() { return this.chess.isCheck(); }
  isCheckmate() { return this.chess.isCheckmate(); }
  isStalemate() { return this.chess.isStalemate(); }
  isDraw() { return this.chess.isDraw(); }


  winner(): "w" | "b" | "draw" | null {
    if (this.isCheckmate()) return this.turn() === "w" ? "b" : "w";
    if (this.isStalemate() || this.isDraw()) return "draw";
    return null;
  }


  lastMove(): Move | undefined { return this._lastMove; }

  board() {
    // rank 8..1 -> rows 0..7, files a..h -> cols 0..7
    return this.chess.board();
  }

  legalMoves(from?: Square): Move[] {
    return this.chess.moves({ square: from, verbose: true }) as Move[];
  }

  historyUci(): string[] {
    const hist = this.chess.history({ verbose: true }) as Array<{ from: string; to: string; promotion?: string }>;
    return hist.map(m => m.from + m.to + (m.promotion ?? ""));
  }

  moveUci(uci: string, autoQueen = false): Move | null {
    // basic UCI validation: e2e4 or e7e8q
    if (!/^[a-h][1-8][a-h][1-8]([qrbn])?$/.test(uci)) return null;
    // "e2e4" or "e7e8q"
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    let promotion: "q" | "r" | "b" | "n" | undefined =
      uci.length === 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;

    // Optional auto-queen: only if it's actually a promotion move
    if (!promotion && autoQueen) {
      const cand = (this.chess.moves({ square: from, verbose: true }) as Move[])
        .find(m => m.to === to && m.flags.includes("p"));
      if (cand) promotion = "q";
    }

    const res = this.chess.move({ from, to, promotion }) as Move | null;
    if (res) this._lastMove = res; this.emit();
    return res; // null on illegal; Move on success
  }
}


export const game = new Game();
export type BoardSquare = ReturnType<Game["board"]>[number][number];
