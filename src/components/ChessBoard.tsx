import { Audio } from "expo-av";
import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { BoardSquare, game } from "../lib/chess";
import GameStatus from "./GameStatus";


type Status = {
    turn: "w" | "b";
    isMate: boolean;
    isDrawn: boolean;
    isCheck: boolean;
    winner: "w" | "b" | "draw" | null;
};

function readStatus(): Status {
    return {
        turn: game.turn(),
        isMate: game.isCheckmate(),
        isDrawn: game.isStalemate() || game.isDraw(),
        isCheck: game.isCheck(),
        winner: (game as any).winner?.() ?? // if you added winner()
            (game.isCheckmate() ? (game.turn() === "w" ? "b" : "w")
                : (game.isStalemate() || game.isDraw()) ? "draw" : null),
    };
}

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

// utils/coords.ts
export function squareToRC(sq: string) {
    // files a..h → 0..7 ; ranks 8..1 → 0..7
    const c = sq.charCodeAt(0) - 97;          // 'a' → 0
    const r = 8 - parseInt(sq[1], 10);        // '8' → 0, '1' → 7
    return { r, c };
}


export default function ChessBoard() {
    const [status, setStatus] = useState<Status>(readStatus());
    const [selected, setSelected] = useState<string | null>(null);
    const [targets, setTargets] = useState<Set<string>>(new Set());

    type PromoState = { from: string; to: string } | null;
    const [promo, setPromo] = useState<PromoState>(null);

    const b = game.board();
    const isCheck = game.isCheck();
    const isMate = game.isCheckmate();
    const isDrawn = game.isStalemate() || game.isDraw();
    const result = game.winner(); // "w" | "b" | "draw" | null
    const checkedKingSq = isCheck ? findKingSquare(game.turn(), b) : null;

    const [sndMoveSelf] = useState(() => new Audio.Sound());
    const [sndCapture] = useState(() => new Audio.Sound());
    const [sndCastle] = useState(() => new Audio.Sound());
    const [sndCheck] = useState(() => new Audio.Sound());
    const [sndPromote] = useState(() => new Audio.Sound());
    const [sndIllegal] = useState(() => new Audio.Sound());
    const [sndGameEnd] = useState(() => new Audio.Sound());


    const onSquarePress = (a: string) => {
        // Read board BEFORE any move (needed for capture/en passant sound heuristics)
        const b = game.board();
        const r = 8 - Number(a[1]);           // row index of target square
        const c = a.charCodeAt(0) - 97;       // col index of target square
        const destHadPiece = !!b[r][c];       // did target square already have a piece?
        const sq = b[r][c] as BoardSquare;    // piece or null at target

        // ── 1) No selection yet: first click = select your own piece ────────────────
        if (!selected) {
            if (sq && sq.color === game.turn()) {
                setSelected(a);
                const movesFromA = game.legalMoves(a as any);
                setTargets(new Set(movesFromA.map(m => m.to)));
            } else {
                // optional: play illegal tap sound here
                sndIllegal.replayAsync().catch(() => { });
            }
            return; // IMPORTANT: do not attempt any move yet
        }

        // ── 2) If you click another of your pieces, switch selection ───────────────
        if (sq && sq.color === game.turn()) {
            setSelected(a);
            const movesFromA = game.legalMoves(a as any);
            setTargets(new Set(movesFromA.map(m => m.to)));
            return;
        }

        // ── 3) Attempt to move from `selected` to `a` (handle promotion first) ─────
        const cand = game.legalMoves(selected as any).find(m => m.to === a);

        // Not a legal destination from selected piece → illegal
        if (!cand) {
            sndIllegal.replayAsync().catch(() => { });
            setSelected(null);
            setTargets(new Set());
            return;
        }

        // Promotion? open picker; do NOT execute yet
        if (cand.flags.includes("p")) {
            setPromo({ from: selected, to: a });
            // keep selection so picker can call executeMove(from, to, piece)
            return;
        }

        // Execute the non-promotion move now
        const res = game.moveUci(selected + a); // returns Move | null (never throws)
        if (!res) {
            sndIllegal.replayAsync().catch(() => { });
            setSelected(null);
            setTargets(new Set());
            return;
        }

        setStatus(readStatus());

        // ── 4) Sounds based on the executed move’s flags and board state ───────────
        const flags = res.flags ?? ""; // 'c' capture, 'e' en-passant, 'k'/'q' castle, 'p' promote
        const played =
            (flags.includes("k") || flags.includes("q")) ? sndCastle :
                flags.includes("p") ? sndPromote :
                    (flags.includes("c") || flags.includes("e") || destHadPiece) ? sndCapture :
                        game.isCheckmate() || game.isStalemate() || game.isDraw() ? sndGameEnd :
                            game.isCheck() ? sndCheck :
                                sndMoveSelf;

        played.replayAsync().catch(() => { });

        // ── 5) Clear UI state ──────────────────────────────────────────────────────
        setSelected(null);
        setTargets(new Set());

    };

    const onReset = () => {
        game.reset();
        setStatus(readStatus());   // <- also update on reset
    };

    const executeMove = (from?: string | null, to?: string | null, promotion?: "q" | "r" | "b" | "n") => {
        if (!from || !to) return false; // <-- prevent "null" going through
        // read board BEFORE the move (for capture sound incl. en passant)
        const b = game.board();
        const { r, c } = squareToRC(to);
        const destHadPiece = !!b[r][c];

        const cand = game.legalMoves(from as any).find(m => m.to === to);
        // If this move is a promotion and we don't yet have the choice, open picker.
        if (!promotion && cand && cand.flags.includes("p")) {
            setPromo({ from, to });  // elsewhere you'll call executeMove(from,to,choice)
            return false;
        }

        // Build UCI and make the move
        const uci = from + to + (promotion ?? "");
        const res = game.moveUci(uci);
        if (!res) {
            sndIllegal.replayAsync().catch(() => { });
            return false;
        }

        // pick the right sound
        const flags = res.flags ?? ""; // from chess.js Move we just executed
        const played =
            (flags.includes("k") || flags.includes("q")) ? sndCastle :
                flags.includes("p") ? sndPromote :
                    (flags.includes("c") || flags.includes("e") || destHadPiece)
                        ? sndCapture
                        : game.isCheck()
                            ? sndCheck
                            : sndMoveSelf;
        played.replayAsync().catch(() => { });
        return true;
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
                {promo && (
                    <Modal transparent animationType="fade" onRequestClose={() => setPromo(null)}>
                        <View style={{
                            flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
                            alignItems: "center", justifyContent: "center"
                        }}>
                            <View style={{
                                backgroundColor: "#222", borderRadius: 16, padding: 14, width: 260
                            }}>
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
                                    Promote to
                                </Text>
                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                    {(["q", "r", "b", "n"] as const).map(p => (
                                        <Pressable
                                            key={p}
                                            onPress={() => {
                                                if (!promo) return;
                                                executeMove(promo.from, promo.to, p);
                                                setPromo(null);
                                            }}
                                            style={{
                                                width: 56, height: 56, borderRadius: 12,
                                                backgroundColor: "#333", alignItems: "center", justifyContent: "center"
                                            }}
                                        >
                                            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{p.toUpperCase()}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <Pressable onPress={() => setPromo(null)} style={{ marginTop: 10, alignSelf: "center" }}>
                                    <Text style={{ color: "#bbb" }}>Cancel</Text>
                                </Pressable>
                            </View>
                        </View>
                    </Modal>
                )}

            </View>
            <GameStatus status={status} />
        </View>
    );
}
