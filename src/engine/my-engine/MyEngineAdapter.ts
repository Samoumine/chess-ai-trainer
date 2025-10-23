import type {
    Engine, EngineOptions, PositionInfo, Recommendation
} from "../../engine/types";
import { MinimaxEngine } from "../../services/MinimaxEngine";

type GoInfo = {
  depth?: number;
  nodes?: number;
  scoreCp?: number;
  pv?: string[];
};

function mapDifficultyToSkill(d?: EngineOptions["difficulty"]): number {
  if (d === "beginner") return 3;
  if (d === "hard") return 18;
  return 10; 
}

function mapDifficultyToMovetime(d?: EngineOptions["difficulty"]): number {
  if (d === "beginner") return 300;
  if (d === "hard") return 1500;
  return 800; 
}

export class MyEngineAdapter implements Engine {
  readonly kind = "myengine" as const;

  private core: MinimaxEngine | null = null; 
  private opts: EngineOptions = {};
  private lastInfo: GoInfo = {};             

  constructor() {}

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------
  async init(): Promise<void> {
    if (this.core) return;
    const core = new MinimaxEngine();
    this.core = core;

    core.onMessage((line) => {
      // examples we emit from MinimaxEngine:
      //  info depth 3 nodes 1234 score cp 42
      //  bestmove e2e4
      if (typeof line !== "string") return;

      if (line.startsWith("info ")) {
        const mDepth = / depth\s+(\d+)/.exec(line);
        const mNodes = / nodes\s+(\d+)/.exec(line);
        const mScore = / score cp\s+(-?\d+)/.exec(line);
        if (mDepth) this.lastInfo.depth = Number(mDepth[1]);
        if (mNodes) this.lastInfo.nodes = Number(mNodes[1]);
        if (mScore) this.lastInfo.scoreCp = Number(mScore[1]);
      }
    });

    // UCI-ish handshake (our Mini engine supports these)
    core.send("uci");
    core.send("isready");
    core.send("ucinewgame");

    // apply initial options (if any were set pre-init)
    this.applyOptions();
  }

  async dispose(): Promise<void> {
    try { this.core?.stop(); } catch {}
    this.core = null;
  }

  // --------------------------------------------------------------------------
  // Options
  // --------------------------------------------------------------------------
  setOptions(opts: EngineOptions): void {
    this.opts = { ...this.opts, ...opts };
    this.applyOptions();
  }

  private applyOptions() {
    if (!this.core) return;
    const skill = mapDifficultyToSkill(this.opts.difficulty);
    try { this.core.send(`setoption name Skill Level value ${skill}`); } catch {}
  }

  // --------------------------------------------------------------------------
  // Analyze / Move
  // --------------------------------------------------------------------------
  async analyze(pos: PositionInfo): Promise<Recommendation> {
    if (!this.core) throw new Error("MyEngine not initialized");
    this.lastInfo = {}; // reset telemetry

    this.core.send("position fen " + pos.fen);

    const movetime =
      Math.max(50, this.opts.moveTimeMs ?? mapDifficultyToMovetime(this.opts.difficulty));

    const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const best = await this.waitBestMove(movetime);

    const tookMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
    );

    return {
      bestMoveUci: best ?? null,
      scoreCp: this.lastInfo.scoreCp,
      mateIn: undefined,      
      depth: this.lastInfo.depth,
      nodes: this.lastInfo.nodes,
      pv: undefined,          
      engine: this.kind,
      tookMs,
    };
  }

  async requestMove(pos: PositionInfo): Promise<Recommendation> {
    return this.analyze(pos);
  }

  private waitBestMove(movetime: number): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.core) return resolve(null);

      let settled = false;

      const off = this.core.onMessage((line) => {
        if (settled || typeof line !== "string") return;

        if (line.startsWith("bestmove")) {
          settled = true;
          off?.();
          const uci = line.split(/\s+/)[1];
          resolve(uci && uci !== "(none)" ? uci : null);
        }
      });

      this.core.send(`go movetime ${movetime}`);

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        off?.();
        resolve(null);
      }, movetime + 150);

      const clearAll = () => { try { clearTimeout(timer); } catch {} };
    });
  }
}
