// src/engine/stockfish-adapter.ts
import type {
    Engine, EngineOptions, PositionInfo, Recommendation
} from "../engine/types";
import { StockfishService } from "../services/StockfishService.web";

// Map our difficulty → Stockfish skill (0..20)
function mapDifficultyToSkill(d?: EngineOptions["difficulty"]): number {
    let skill = 10;
    if (d === "beginner") skill = 3;
    else if (d === "intermediate") skill = 10;
    else if (d === "hard") skill = 18;
    return Math.max(0, Math.min(20, skill));
}

// Map our difficulty → default movetime (ms) if none passed
function mapDifficultyToMovetime(d?: EngineOptions["difficulty"]): number {
    if (d === "beginner") return 300;
    if (d === "intermediate") return 800;
    if (d === "hard") return 1500;
    return 800;
}

export class StockfishEngine implements Engine {
    readonly kind = "stockfish" as const;
    private sf: StockfishService | null = null;
    private opts: EngineOptions = {};

    constructor(private workerUrl = "/engines/stockfish/stockfish.wasm.js") { }

    async init(): Promise<void> {
        this.sf = new StockfishService(this.workerUrl);
        await this.sf.init();
        // Apply current options (if any) after init.
        this.applyOptions();
    }

    setOptions(opts: EngineOptions): void {
        this.opts = { ...this.opts, ...opts };
        this.applyOptions();
    }

    private applyOptions() {
        if (!this.sf) return;
        const lvl = mapDifficultyToSkill(this.opts.difficulty);
        try {
            (this.sf as any).setSkillLevel?.(lvl);
        } catch {
            // ignore – still playable with movetime only
        }
    }

    async analyze(pos: PositionInfo): Promise<Recommendation> {
        if (!this.sf) throw new Error("Stockfish not initialized");
    const now = typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
    const start = now();

        // Position first
        await (this.sf.setPositionFEN?.(pos.fen) ?? Promise.resolve());

        // Movetime: explicit takes precedence; otherwise from difficulty
        const movetime = Math.max(250, this.opts.moveTimeMs ?? mapDifficultyToMovetime(this.opts.difficulty));

        const info = await this.sf.go({ movetime });
        const tookMs = Math.round(now() - start);

        return {
            bestMoveUci: info.bestmove ?? null,
            scoreCp: info.scoreCp,
            mateIn: info.mateIn,
            depth: info.depth,
            nodes: info.nodes,
            pv: info.pv,
            engine: this.kind,
            tookMs,
        };
    }

    async requestMove(pos: PositionInfo): Promise<Recommendation> {
        // For Stockfish, "play a move" == "analyze and take best"
        return this.analyze(pos);
    }

    async dispose(): Promise<void> {
        try { await this.sf?.dispose?.(); } catch {}
        this.sf = null;
    }
}
