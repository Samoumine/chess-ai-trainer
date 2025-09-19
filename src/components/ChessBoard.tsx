import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { game, BoardSquare } from "../../src/lib/chess";

const SQUARE = 44; // personalize: make 36 for smaller squares or 60 for bigger

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
                            return (
                                <Pressable
                                    key={c}
                                    onPress={() => onSquarePress(a)}
                                    style={{
                                        width: SQUARE, height: SQUARE,
                                        alignItems: "center", justifyContent: "center",
                                        backgroundColor: isSelected ? "#88c" : (isDark ? "#769656" : "#eeeed2"),
                                        // personalize: change colors (#769656 = green, #eeeed2 = beige)
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
            <Text style={{ color: "#ccc", marginTop: 12 }}>
                Turn: {turn === "w" ? "White" : "Black"} {game.isGameOver() ? "— Game Over" : ""}
            </Text>
        </View>
    );
}
