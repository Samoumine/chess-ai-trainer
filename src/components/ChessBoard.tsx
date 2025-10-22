import { Audio } from "expo-av";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BoardSquare, game } from "../lib/chess";
import "../services/engine-registry";
import { engine } from "../services/engine-singleton";
import { MinimaxEngine } from "../services/MinimaxEngine";
import GameStatus from "./GameStatus";
import PromotionPicker from "./PromotionPicker";


export default function ChessBoard() {
    // ── State ─────────────────────────────────────────────────────────────────────
    const [status, setStatus] = useState<Status>(readStatus());
    const [selected, setSelected] = useState<string | null>(null);
    const [targets, setTargets] = useState<Set<string>>(new Set());

    const engineRef = React.useRef<MinimaxEngine | null>(null);
    const engineReadyRef = React.useRef(false);
    const [engineOn, setEngineOn] = React.useState(false);
    const [engineSide, setEngineSide] = React.useState<"w" | "b">("b");
    const [engineKind, setEngineKind] = React.useState<"stockfish" | "myengine">("stockfish");
    const [engineIdName, setEngineIdName] = React.useState<string>("(unknown)");
    // optional UI-only mirror of readiness:
    const [engineReady, setEngineReady] = React.useState(false);

    type PromoState = { from: string; to: string; color: "w" | "b" } | null;
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


    type Level = "beginner" | "intermediate" | "hard";
    const [level, setLevel] = React.useState<Level>("beginner");

    const onSquarePress = (a: string) => {
        const b = game.board();
        const r = 8 - Number(a[1]);
        const c = a.charCodeAt(0) - 97;
        const sq = b[r][c] as BoardSquare | null;

        // 1) No selection yet — select your own piece
        if (!selected) {
            if (sq && sq.color === game.turn()) {
                setSelected(a);
                const moves = game.legalMoves(a as any);
                setTargets(new Set(moves.map(m => m.to)));
            } else {
                sndIllegal.replayAsync().catch(() => { });
            }
            return;
        }

        // 2) If you tap another of your own pieces — switch selection
        if (sq && sq.color === game.turn()) {
            setSelected(a);
            const moves = game.legalMoves(a as any);
            setTargets(new Set(moves.map(m => m.to)));
            return;
        }

        // 3) Attempt the move from `selected` to `a`
        const cand = game.legalMoves(selected as any).find(m => m.to === a);

        // illegal destination from the selected square
        if (!cand) {
            sndIllegal.replayAsync().catch(() => { });
            setSelected(null);
            setTargets(new Set());
            return;
        }

        // Promotion? open picker; DO NOT move yet
        if (cand.flags.includes("p")) {
            // color from the FROM square (not target)
            const { r: rf, c: cf } = squareToRC(selected);
            const fromPiece = b[rf][cf];
            const color: "w" | "b" = fromPiece?.color === "b" ? "b" : "w";
            setPromo({ from: selected, to: a, color });
            return;
        }

        // 4) Non-promotion move — let executeMove do everything (sounds/status/engine)
        const ok = executeMove(selected, a);
        if (ok) scheduleEngineThink();
    };


    const onPickPromotion = (piece: "q" | "r" | "b" | "n") => {
        if (!promo) return;

        const b = game.board();
        const { r: tr, c: tc } = squareToRC(promo.to);
        const destHadPiece = !!b[tr][tc];

        const uci = promo.from + promo.to + piece;
        const res = game.moveUci(uci);
        setPromo(null);
        if (!res) {
            sndIllegal.replayAsync().catch(() => { });
            setSelected(null);
            setTargets(new Set());
            return;
        }

        const flags = res.flags ?? ""; // 'p' promote, 'c' capture, 'e' en-passant, 'k'/'q' castle
        const played =
            (flags.includes("k") || flags.includes("q")) ? sndCastle :
                flags.includes("p") ? sndPromote :                                // <-- promotion wins
                    (flags.includes("c") || flags.includes("e") || destHadPiece) ? sndCapture :
                        game.isCheckmate() || game.isStalemate() || game.isDraw() ? sndGameEnd :
                            game.isCheck() ? sndCheck :
                                sndMoveSelf;

        played.replayAsync().catch(() => { });

        setSelected(null);
        setTargets(new Set());
        setStatus(readStatus()); // if you're using the status-props approach
        scheduleEngineThink();
    };

    const onCancelPromotion = () => setPromo(null);


    const onReset = () => {
        game.reset();
        setStatus(readStatus());
    };

    const executeMove = (from?: string | null, to?: string | null, promotion?: "q" | "r" | "b" | "n") => {
        if (!from || !to) return false;
        const b = game.board();
        const { r: tr, c: tc } = squareToRC(to);
        const destHadPiece = !!b[tr][tc];


        const { r: fr, c: fc } = squareToRC(from!);
        const fromPiece = b[fr][fc];
        const color: "w" | "b" = fromPiece?.color === "b" ? "b" : "w";
        const cand = game.legalMoves(from as any).find(m => m.to === to);
        if (!promotion && cand && cand.flags.includes("p")) {
            setPromo({ from, to, color });
            return false;
        }

        // Build UCI and make the move
        const uci = from + to + (promotion ?? "");
        const res = game.moveUci(uci);
        if (!res) {
            sndIllegal.replayAsync().catch(() => { });
            return false;
        }

        setSelected(null);
        setTargets(new Set());
        setStatus(readStatus());

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
        console.log("[MOVE] executed", { from, to, promotion, nextTurn: game.turn() });
        scheduleEngineThink();
        return true;
    };


    const skillFor = (lv: Level) => (lv === "beginner" ? 0 : lv === "intermediate" ? 10 : 20);
    const applyLevel = (lv: Level) => {
        const eng = engineRef.current;
        if (!eng) return;
        const n = skillFor(lv);
        eng.send(`setoption name Skill Level value ${n}`);
        console.log(`[ui] level=${lv} -> skill=${n}`);
    };

    // whenever the level state changes, push it to engine
    React.useEffect(() => { applyLevel(level); }, [level]);

    // ── Load sounds ───────────────────────────────────────────────────────────────
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
                    sndGameEnd.loadAsync(require("../../assets/sounds/game-end.mp3")).catch(() => { }),
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

    // ── Engine integration ───────────────────────────────────────────────────────
    const requestEngineMove = React.useCallback(() => {
        const eng = engineRef.current;
        const ready = engineReadyRef.current;
        console.log("[REQ] called", { engineOn, ready, turn: game.turn(), engineSide });

        if (!engineOn || !eng || !ready) { console.log("[REQ] abort: engine off/not ready"); return; }
        if (game.isGameOver()) { console.log("[REQ] abort: game over"); return; }
        if (game.turn() !== engineSide) { console.log("[REQ] abort: not engine turn"); return; }

        const fen = game.fen();
        console.log("[REQ] sending", { fen });
        eng.send("position fen " + fen);
        console.log("[REQ] go movetime 800");
        eng.send("go movetime 800");
    }, [engineOn, engineSide]);

    React.useEffect(() => {
        const handleUciLine = (line: string) => {
            const m = /^id name\s(.)$/.exec(line);
            if (m) setEngineIdName(m[1].trim());
        };
        (window as any).__handleUciLine = handleUciLine;
        return () => { delete (window as any).__handleUciLine; };
    }, []);

    // Expose lightweight debug info for console
    React.useEffect(() => {
        (window as any).__boardDebug = {
            engineOn, engineSide, // "w" | "b"
            engineKind,           // "stockfish" | "myengine" (UI label for now)
            engineIdName,         // parsed from UCI "id name"
        };
        (window as any).__engineWorker = engineRef.current; // your UCI service instance
    }, [engineOn, engineSide, engineKind, engineIdName]);


    const thinkTimerRef = React.useRef<any>(null);
    const scheduleEngineThink = React.useCallback(() => {
        if (thinkTimerRef.current) {
            clearTimeout(thinkTimerRef.current);
            thinkTimerRef.current = null;
        }
        thinkTimerRef.current = setTimeout(() => {
            requestEngineMove();
        }, 150);
    }, [requestEngineMove]);

    const startEngine = React.useCallback(async () => {
        if (engineRef.current) return; // already running
        console.log("[ENG] starting...");
        const eng = new MinimaxEngine();
        engineRef.current = eng;
        engineReadyRef.current = false;
        setEngineReady(false);

        await eng.start();
        eng.onMessage(line => {
            console.log("[ENG]", line);
            if (typeof line === "string" && line.startsWith("bestmove")) {
                const uci = line.split(/\s+/)[1];
                console.log("[ENG] bestmove", uci);
                if (!uci || uci === "(none)") return;
                if (game.isGameOver()) { console.log("[ENG] abort: game over"); return; }
                if (game.turn() !== engineSide) { console.log("[ENG] abort: not engine turn"); return; }
                const ok = executeMove(uci.slice(0, 2), uci.slice(2, 4), uci[4] as any);
                console.log("[ENG] applied", { ok, uci });
            }
        });

        // Handshake
        eng.send("uci");
        eng.send("isready");
        eng.send("ucinewgame");

        // Mark ready
        engineReadyRef.current = true;
        setEngineReady(true);

        // If it's already engine's turn, kick once
        if (!game.isGameOver() && game.turn() === engineSide) {
            setTimeout(() => {
                console.log("[KICK] engine to move now (ready)");
                requestEngineMove();
            }, 0);
        }
    }, [engineSide, requestEngineMove]);

    const stopEngine = React.useCallback(() => {
        console.log("[ENG] stopping...");
        try { engineRef.current?.stop(); } catch { }
        engineRef.current = null;
        engineReadyRef.current = false;
        setEngineReady(false);
    }, []);

    React.useEffect(() => {
        if (engineOn && engineKind === "myengine") {
            console.warn("[Engine] MyEngine not wired yet here. Turning engine OFF.");
            setEngineOn(false);
            stopEngine(); // your existing teardown
            // (Optional) toast: "MyEngine coming soon"
        }
    }, [engineKind]);


    React.useEffect(() => {
        if (engineOn && engineSide === "w" && !game.isGameOver() && game.turn() === "w") {
            requestEngineMove();
        }
        // run when engine toggled or side changes
    }, [engineOn, engineSide, requestEngineMove]);

    React.useEffect(() => {
        if (engineOn && !game.isGameOver() && game.turn() === engineSide) {
            console.log("[KICK] engine to move now");
            requestEngineMove();
        }
    }, [engineOn, engineSide, requestEngineMove]);


    React.useEffect(() => {

        if (!engineOn) {
            engineRef.current?.stop();
            engineRef.current = null;
            setEngineReady(false);
            return;
        }
        const eng = new MinimaxEngine();
        engineRef.current = eng;
        (async () => {
            await eng.start();
            eng.onMessage(line => {
                console.log("[ENG]", line);
                // Parse bestmove
                if (typeof line === "string" && line.startsWith("bestmove")) {
                    const uci = line.split(/\s+/)[1];
                    console.log("[ENG] bestmove", uci);
                    if (!uci || uci === "(none)") return;
                    if (game.isGameOver()) { console.log("[ENG] abort: game over"); return; }
                    if (game.turn() !== engineSide) { console.log("[ENG] abort: not engine turn"); return; }
                    const from = uci.slice(0, 2);
                    const to = uci.slice(2, 4);
                    const promotion = uci[4] as "q" | "r" | "b" | "n" | undefined;
                    const ok = executeMove(from, to, promotion);
                    console.log("[ENG] applied", { ok, from, to, promotion });
                }
            });
            // UCI handshake (lightweight for our engine)
            eng.send("uci");
            eng.send("isready");
            eng.send("ucinewgame");
            setEngineReady(true);
            // If it's already the engine's turn (e.g., engine plays White), kick once
            if (!game.isGameOver() && game.turn() === engineSide) {
                console.log("[KICK] engine to move now (ready)");
                requestEngineMove(); // will pass the ready check below
            }
        })();
        return () => {
            engineRef.current?.stop();
            engineRef.current = null;
            setEngineReady(false);
        };
    }, [engineOn, engineSide]);

    React.useEffect(() => {
        const off = engine.onMessage((line) => {
            if (!line.startsWith("bestmove ")) return;
            const uci = line.slice(9).trim();          // e.g., "g8f6"
            if (!uci || uci === "(none)" || game.isGameOver()) return;

            const ok = game.moveUci(uci);
            if (ok) {
                // any sounds you want for engine moves can go here (optional)
                setStatus(readStatus());                 // <- this is your re-render trigger
            }
        });
        return () => off?.();
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
            <PromotionPicker
                visible={!!promo}
                color={promo?.color ?? "w"}
                onPick={onPickPromotion}
                onCancel={onCancelPromotion}
            />
            <GameStatus status={status} />
            <View style={{ marginTop: 8, flexDirection: "row", gap: 8, justifyContent: "center" }}>
                {/* Engine turn ON/OFF switcher (UI only for now) */}
                <Pressable
                    onPress={async () => {
                        if (engineOn) {
                            setEngineOn(false);
                            stopEngine();
                        } else {
                            setEngineOn(true);
                            await startEngine();
                        }
                    }}
                    style={{ backgroundColor: engineOn ? "#265d2a" : "#444", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                        {engineOn ? "Engine: ON" : "Engine: OFF"}
                    </Text>
                </Pressable>
                {/* Engine Color switcher (UI only for now) */}
                <Pressable
                    onPress={() => {
                        setEngineSide(s => {
                            const next = s === "w" ? "b" : "w";
                            // If engine is ON and it becomes engine's turn after switching, kick
                            setTimeout(() => {
                                if (engineOn && !game.isGameOver() && game.turn() === next) {
                                    console.log("[KICK] side switched; engine to move now");
                                    scheduleEngineThink();
                                }
                            }, 0);
                            return next;
                        });
                    }}
                    disabled={engineOn} // you can allow switching live if you prefer
                    style={{ backgroundColor: "#333", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, opacity: engineOn ? 0.5 : 1 }}
                >
                    <Text style={{ color: "#fff" }}>
                        Engine plays: {engineSide === "w" ? "White" : "Black"}
                    </Text>
                </Pressable>

                {/* Engine Kind switcher (UI only for now) */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable
                        onPress={() => setEngineKind("stockfish")}
                        style={{
                            backgroundColor: engineKind === "stockfish" ? "#2b4d9a" : "#444",
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10
                        }}
                    >
                        <Text style={{ color: "#fff" }}>Stockfish</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setEngineKind("myengine")}
                        style={{
                            backgroundColor: engineKind === "myengine" ? "#2b4d9a" : "#444",
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                            opacity: engineOn ? 0.6 : 1
                        }}
                    >
                        <Text style={{ color: "#fff" }}>MyEngine</Text>
                    </Pressable>
                </View>

                {/* Live status label (truth from the engine's own UCI "id name") */}
                <View style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#222", borderRadius: 10 }}>
                    <Text style={{ color: "#bbb", fontSize: 12 }}>
                        Active Engine: {engineIdName}
                    </Text>
                </View>

                {/* Hint (two-stage) — placeholder for now*/}
                <Pressable
                    onPress={() => {
                        console.log("[HINT] stage A → recommend a piece (to be wired in hints milestone)");
                        // Next press: commit best move using that piece — coming later.
                    }}
                    style={{ backgroundColor: "#555", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                >
                    <Text style={{ color: "#fff" }}>Hint</Text>
                </Pressable>
            </View>
            {/* Level switch row */}
            {/* <View style={{ padding: 12 }}>
                <LevelSwitch value={level} onChange={setLevel} />
            </View> */}
        </View>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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


// ── Utils ──────────────────────────────────────────────────────────────────────

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
    const blackMap: Record<string, string> = { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" };
    const whiteMap: Record<string, string> = { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" };
    const glyph = (sq.color === "w" ? whiteMap : blackMap)[sq.type] ?? "?";
    // You can still tint slightly if you want; but glyph choice now carries the color semantics.
    const color = sq.color === "w" ? "#eaeaea" : "#111";
    return <Text style={{ fontSize: 28, color }}>{glyph}</Text>;
}


export function squareToRC(sq: string) {
    // files a..h → 0..7 ; ranks 8..1 → 0..7
    const c = sq.charCodeAt(0) - 97;          // 'a' → 0
    const r = 8 - parseInt(sq[1], 10);        // '8' → 0, '1' → 7
    return { r, c };
}


