// Minimal UCI client for Stockfish WASM/JS worker.
// Assumes you have placed the engine files in /public/engines/stockfish/ (see README).
// We only use what we need: init, setSkillLevel, setPositionFEN, go({movetime}), dispose.

type GoResult = {
  bestmove: string | null;
  scoreCp?: number;
  mateIn?: number;
  depth?: number;
  nodes?: number;
  pv?: string[];
};

export class StockfishService {
  private worker: Worker | null = null;
  private listeners: Array<(line: string) => boolean> = [];
  private lastInfo: Partial<GoResult> = {};

  constructor(private workerUrl: string = "/engines/stockfish/stockfish-17.1-lite-single-03e3232.js") { }

  async init(): Promise<void> {
    if (this.worker) return;
    this.worker = new Worker(this.workerUrl);
    this.worker.onmessage = (e) => this.onMsg(String(e.data));

    this.send("uci");
    await this.waitFor((l) => l.includes("uciok"));

    this.send("isready");
    await this.waitFor((l) => l.includes("readyok"));

    this.send("ucinewgame");
    this.lastInfo = {};
  }

  async dispose(): Promise<void> {
    this.worker?.terminate();
    this.worker = null;
    this.listeners = [];
    this.lastInfo = {};
  }

  setSkillLevel(skill: number) {
    this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, skill | 0))}`);
  }

  setPositionFEN(fen: string) {
    this.send(`position fen ${fen}`);
  }

  async go(params: { movetime: number }): Promise<GoResult> {
    this.lastInfo = {};
    this.send(`go movetime ${Math.max(1, Math.floor(params.movetime))}`);

    const best = await this.waitFor((l) => l.startsWith("bestmove "));
    const [, bestMove] = best.split(/\s+/);
    const pv = this.lastInfo.pv ?? [];

    return {
      bestmove: bestMove && bestMove !== "(none)" ? bestMove : null,
      scoreCp: this.lastInfo.scoreCp,
      mateIn: this.lastInfo.mateIn,
      depth: this.lastInfo.depth,
      nodes: this.lastInfo.nodes,
      pv,
    };
  }

  private send(cmd: string) {
    if (!this.worker) throw new Error("Stockfish worker not initialized");
    this.worker.postMessage(cmd);
  }

  private onMsg(raw: string) {
    // Stockfish can send multiple lines per message. Split and process each.
    const lines = String(raw).split(/\r?\n/).filter(l => l.trim().length > 0);
    for (const line of lines) {
      // Parse "info" lines to capture depth/score/nodes/pv
      if (line.startsWith("info ")) {
        this.parseInfo(line);
      }
      // Notify listeners; keep the ones that are still waiting
      if (this.listeners.length) {
        const next: Array<(l: string) => boolean> = [];
        for (const fn of this.listeners) {
          try {
            const done = fn(line);
            if (!done) next.push(fn);
          } catch {
            // drop that listener on error
          }
        }
        this.listeners = next;
      }
    }
  }
  private waitFor(predicate: (line: string) => boolean, timeoutMs = 5000): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        // remove our listener on timeout
        this.listeners = this.listeners.filter((fn) => fn !== listener);
        reject(new Error("StockfishService timeout"));
      }, timeoutMs);

      const listener = (line: string) => {
        if (predicate(line)) {
          clearTimeout(timer);
          resolve(line);
          return true; // remove this listener
        }
        return false; // keep listening
      };

      this.listeners.push(listener);
    });
  }
  private parseInfo(line: string) {
    const parts = line.split(/\s+/);
    let pvStart = parts.indexOf("pv");
    if (pvStart >= 0) this.lastInfo.pv = parts.slice(pvStart + 1);
    const d = parts.indexOf("depth");
    if (d >= 0 && parts[d + 1]) this.lastInfo.depth = Number(parts[d + 1]);
    const n = parts.indexOf("nodes");
    if (n >= 0 && parts[n + 1]) this.lastInfo.nodes = Number(parts[n + 1]);
    const s = parts.indexOf("score");
    if (s >= 0) {
      const kind = parts[s + 1];
      const val = Number(parts[s + 2]);
      if (kind === "cp") this.lastInfo.scoreCp = isFinite(val) ? val : undefined;
      if (kind === "mate") this.lastInfo.mateIn = isFinite(val) ? val : undefined;
    }
  }
}
