import { Audio } from "expo-av";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BoardSquare, game } from "../../src/lib/chess";
import GameStatus from "./GameStatus";


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
    const checkedKingSq = isCheck ? findKingSquare(turn, b) : null;

    const [sndMoveSelf] = useState(() => new Audio.Sound());
    const [sndCapture] = useState(() => new Audio.Sound());
    const [sndCastle] = useState(() => new Audio.Sound());
    const [sndCheck] = useState(() => new Audio.Sound());
    const [sndPromote] = useState(() => new Audio.Sound());
    const [sndIllegal] = useState(() => new Audio.Sound());
    const [sndGameEnd] = useState(() => new Audio.Sound());


    const onSquarePress = (a: string) => {
        const r = 8 - Number(a[1]);      // row index of target square
        const c = a.charCodeAt(0) - 97;  // col index of target square
        const destHadPiece = !!b[r][c];  // true if target square already had a piece
        const sq = b[r][c];
        const ok = game.moveUci(selected + a);
        const moves = game.legalMoves(a as any);

        if (!selected) {
            if (sq && sq.color === game.turn()) {
                setSelected(a);
                setTargets(new Set(moves.map(m => m.to)));
            }
            return;
        } else {
            if (sq && sq.color === game.turn()) {
                setSelected(a);
                setTargets(new Set(moves.map(m => m.to)));
                return;
            }
            setSelected(null);
            setTargets(new Set());
            if (ok) {
                setTick(t => t + 1);
                setTurn(game.turn()); // keep label in sync
                (destHadPiece ? sndCapture : sndMoveSelf).replayAsync().catch(() => { });
            }
            if (!ok) {
                sndIllegal.replayAsync().catch(() => { });
                return;
            }
        }
        const last = game.lastMove();
        const flags = last?.flags ?? ""; // 'c' capture, 'k' kingside, 'q' queenside, 'p' promote
        const played =
            (flags.includes("k") || flags.includes("q") ? sndCastle :
                flags.includes("p") ? sndPromote :
                    flags.includes("c") || destHadPiece ? sndCapture :
                        game.isCheckmate() || game.isStalemate() || game.isDraw() ? sndGameEnd :
                            game.isCheck() ? sndCheck :
                                sndMoveSelf);

        played.replayAsync().catch(() => { });
    };

    React.useEffect(() => {
        (async () => {
            try {
                await Promise.all([
                    sndMoveSelf.loadAsync(require("../../assets/sounds/move-self.mp3")),
                    sndCapture.loadAsync(require("../../assets/sounds/capture.mp3")),
                    sndCastle.loadAsync(require("../../assets/sounds/castle.mp3")),
                    sndCheck.loadAsync(require("../../assets/sounds/move-check.mp3")),
                    sndPromote.loadAsync(require("../../assets/sounds/promote.mp3")),
                    sndIllegal.loadAsync(require("../../assets/sounds/illegal.mp3")),
                    // If this fails (e.g., webm), just ignore:
                    sndGameEnd.loadAsync(require("../../assets/sounds/game-end.webm")).catch(() => { }),
                ]);
            } catch (e) {
                console.warn("Sound load error", e);
            }
        })();
        return () => {
            sndMoveSelf.unloadAsync();
            sndCapture.unloadAsync();
            sndCastle.unloadAsync();
            sndCheck.unloadAsync();
            sndPromote.unloadAsync();
            sndIllegal.unloadAsync();
            sndGameEnd.unloadAsync();
        };
    }, []);



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
            <GameStatus turn={turn} />
        </View>
    );
}
