import { Chess, Square, Move } from "chess.js";

class Game {
  private chess = new Chess();

  reset() { this.chess = new Chess(); }
  fen() { return this.chess.fen(); }
  turn(): "w" | "b" { return this.chess.turn(); }
  isGameOver() { return this.chess.isGameOver(); }

  board() {
    // rank 8..1 -> rows 0..7, files a..h -> cols 0..7
    return this.chess.board();
  }

  legalMoves(from?: Square): Move[] {
    return this.chess.moves({ square: from, verbose: true }) as Move[];
  }

  moveUci(uci: string): boolean {
  // "e2e4" or "e7e8q"
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length === 5 ? uci[4] : undefined;
  try {
    const res = this.chess.move({ from, to, promotion });
    return !!res;
  } catch {
    return false;
  }
}

}

export const game = new Game();
export type BoardSquare = ReturnType<Game["board"]>[number][number];
