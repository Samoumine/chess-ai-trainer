import type {
    Engine, EngineKind, EngineOptions, PositionInfo, Recommendation
} from "../engine/types";

import { NullEngine } from "../engine/null-engine"; // safe placeholder

class EngineRegistry {
  private current: Engine | null = null;
  private currentKind: EngineKind | null = null;

  async use(kind: EngineKind, opts?: EngineOptions) {
    if (this.current && this.currentKind === kind) {
      if (opts) this.current.setOptions(opts);
      return this.current;
    }

    if (this.current) {
      await this.current.dispose().catch(() => {});
      this.current = null;
      this.currentKind = null;
    }

    const engine = new NullEngine(kind);
    await engine.init();
    if (opts) engine.setOptions(opts);

    this.current = engine;
    this.currentKind = kind;
    return engine;
  }

  get engine(): Engine | null {
    return this.current;
  }

  async setOptions(opts: EngineOptions) {
    this.current?.setOptions(opts);
  }

  async analyze(pos: PositionInfo): Promise<Recommendation> {
    if (!this.current) throw new Error("No engine selected. Call engineRegistry.use(...) first.");
    return this.current.analyze(pos);
  }

  async requestMove(pos: PositionInfo): Promise<Recommendation> {
    if (!this.current) throw new Error("No engine selected. Call engineRegistry.use(...) first.");
    return this.current.requestMove(pos);
  }

  async dispose() {
    if (this.current) await this.current.dispose().catch(() => {});
    this.current = null;
    this.currentKind = null;
  }
}

export const engineRegistry = new EngineRegistry();

declare global { interface Window { __engineRegistry?: EngineRegistry } }
if (typeof window !== "undefined") {
  (window as any).__engineRegistry = engineRegistry;
}
