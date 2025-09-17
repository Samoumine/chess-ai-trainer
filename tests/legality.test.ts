import { game } from "../src/lib/chess";

beforeEach(() => game.reset());

test("start position has 20 legal moves", () => {
  const starts = ["a2","b2","c2","d2","e2","f2","g2","h2","b1","g1"];
  const legal = new Set(
    starts.flatMap(sq => game.legalMoves(sq as any).map(m => m.from + m.to))
  );
  expect(legal.size).toBe(20);
});

test("cannot move black piece on white's turn", () => {
  // At start it's White to move; try black: "a7a6"
  expect(game.moveUci("a7a6")).toBe(false);
});

test("e2e4 e7e5 g1f3 is legal", () => {
  expect(game.moveUci("e2e4")).toBe(true);
  expect(game.moveUci("e7e5")).toBe(true);
  expect(game.moveUci("g1f3")).toBe(true);
});
