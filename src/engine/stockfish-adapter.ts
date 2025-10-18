// src/engine/stockfish-adapter.ts
import type {
    Engine, EngineOptions, PositionInfo, Recommendation
} from "../engine/types";
import { StockfishService } from "../services/StockfishService.web";

// Map our difficulty → Stockfish skill (0..20)
function mapDifficultyToSkill(d?: EngineOptions["difficulty"]): number {
  if (d === "beginner") return 3;
  if (d === "intermediate") return 10;
  if (d === "hard") return 18;
  return 10; // default
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

  constructor(private workerUrl = "/engines/stockfish/stockfish.wasm.js") {}

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
    this.sf.setSkillLevel(mapDifficultyToSkill(this.opts.difficulty));
  }

  async analyze(pos: PositionInfo): Promise<Recommendation> {
    if (!this.sf) throw new Error("Stockfish not initialized");
    const start = performance.now();

    // Position first
    this.sf.setPositionFEN(pos.fen);

    // Movetime: explicit takes precedence; otherwise from difficulty
    const movetime = Math.max(250, this.opts.moveTimeMs ?? mapDifficultyToMovetime(this.opts.difficulty));

    const info = await this.sf.go({ movetime });
    const tookMs = Math.round(performance.now() - start);

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
    await this.sf?.dispose();
    this.sf = null;
  }
}
