import type {
    Engine, EngineKind, EngineOptions, PositionInfo, Recommendation
} from "../engine/types";

export class NullEngine implements Engine {
  readonly kind: EngineKind;
  private opts: EngineOptions = {};

  constructor(kind: EngineKind) {
    this.kind = kind;
  }

  async init(): Promise<void> {
    // nothing to load
  }

  setOptions(opts: EngineOptions): void {
    this.opts = { ...this.opts, ...opts };
  }

  async analyze(pos: PositionInfo): Promise<Recommendation> {
    // Return a no-op recommendation; useful for wiring tests.
    return {
      bestMoveUci: null,
      scoreCp: 0,
      depth: 0,
      nodes: 0,
      pv: [],
      engine: this.kind,
      tookMs: 0,
    };
  }

  async requestMove(pos: PositionInfo): Promise<Recommendation> {
    return this.analyze(pos);
  }

  async dispose(): Promise<void> {
  }
}
