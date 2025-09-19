import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { game, BoardSquare } from "../../src/lib/chess";

const SQUARE = 44; // personalize: make 36 for smaller squares or 60 for bigger
function findKingSquare(color: "w" | "b", board: (BoardSquare | null)[][]): string | null {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq && sq.type === "k" && sq.color === color) {
                const file = String.fromCharCode(97 + c);
                const rank = String(8 - r);
                return file + rank;
            }
        }
    }
    return null;
}

function algebraic(r: number, c: number) {
    const file = String.fromCharCode("a".charCodeAt(0) + c);
    const rank = (8 - r).toString();
    return (file + rank);
}

function PieceGlyph({ sq }: { sq: BoardSquare | null }) {
    if (!sq) return null;
    const map: Record<string, string> = {
        p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    };
    const glyph = map[sq.type] ?? "?";
    const color = sq.color === "w" ? "#fff" : "#111";
    // personalize: pick colors (e.g., "#e6e6e6" for white, "#333" for black)
    return <Text style={{ fontSize: 28, color }}>{glyph}</Text>;
}

export default function ChessBoard() {
    const [, setTick] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [targets, setTargets] = useState<Set<string>>(new Set());
    const [turn, setTurn] = useState<"w" | "b">(game.turn());
    const b = game.board();
    const isCheck = game.isCheck();
    const isMate = game.isCheckmate();
    const isDrawn = game.isStalemate() || game.isDraw();
    const result = game.winner(); // "w" | "b" | "draw" | null
    // In chess.js, isCheck() is true for the side-to-move
    const checkedKingSq = isCheck ? findKingSquare(turn, b) : null;



    const onSquarePress = (a: string) => {
        if (!selected) {
            // first tap: only allow selecting own piece
            const r = 8 - Number(a[1]);
            const c = a.charCodeAt(0) - 97;
            const sq = b[r][c];
            if (sq && sq.color === game.turn()) {
                setSelected(a);
                const moves = game.legalMoves(a as any);
                setTargets(new Set(moves.map(m => m.to)));
            }
            return;
        } else {
            // if tapping another of your own pieces, switch selection
            const r = 8 - Number(a[1]);
            const c = a.charCodeAt(0) - 97;
            const sq = b[r][c];
            if (sq && sq.color === game.turn()) {
                setSelected(a);
                const moves = game.legalMoves(a as any);
                setTargets(new Set(moves.map(m => m.to)));
                return;
            }

            // otherwise, attempt a move
            const ok = game.moveUci(selected + a);
            setSelected(null);
            setTargets(new Set());
            if (ok) {
                setTick(t => t + 1);
                setTurn(game.turn()); // keep label in sync
            }
        }
    };


    return (
        <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 20 }}>
            <View style={{ width: SQUARE * 8, height: SQUARE * 8, borderWidth: 2, borderColor: "#333" }}>
                {b.map((rank, r) => (
                    <View key={r} style={{ flexDirection: "row" }}>
                        {rank.map((sq, c) => {
                            const a = algebraic(r, c);
                            const isDark = (r + c) % 2 === 1;
                            const isSelected = selected === a;
                            const isCheckedKing = checkedKingSq === a;
                            return (
                                <Pressable
                                    key={c}
                                    onPress={() => onSquarePress(a)}
                                    style={{
                                        width: SQUARE, height: SQUARE,
                                        alignItems: "center", justifyContent: "center",
                                        backgroundColor: isSelected
                                            ? "#88c"
                                            : isCheckedKing
                                                ? "#d06666" // 💡 personalize: check color
                                                : (isDark ? "#769656" : "#eeeed2"),
                                        borderWidth: 0.25, borderColor: "#333",
                                    }}
                                >
                                    <PieceGlyph sq={sq} />
                                    {targets.has(a) && !sq && (
                                        <View pointerEvents="none" style={{
                                            position: "absolute",
                                            width: SQUARE * 0.28,
                                            height: SQUARE * 0.28,
                                            borderRadius: 9999,
                                            opacity: 0.35,
                                            backgroundColor: "#000"
                                        }} />
                                    )}
                                    {targets.has(a) && sq && (
                                        <View pointerEvents="none" style={{
                                            position: "absolute",
                                            inset: 0,
                                            borderWidth: 3,
                                            borderColor: "#000",
                                            opacity: 0.35
                                        }} />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                ))}
            </View>
            <Text style={{ color: "#ccc", marginTop: 12, textAlign: "center" }}>
                {isMate
                    ? (result === "draw"
                        ? "Checkmate — Draw"
                        : `Checkmate — ${result === "w" ? "White" : "Black"} wins`)
                    : isDrawn
                        ? "Draw"
                        : `Turn: ${turn === "w" ? "White" : "Black"}${isCheck ? " — Check" : ""}`}
            </Text>
        </View>
    );
}
