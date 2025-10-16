export type EngineKind = "stockfish" | "myengine";

export type Difficulty = "beginner" | "intermediate" | "hard";

export interface EngineOptions {
  difficulty?: Difficulty;
  moveTimeMs?: number;     
}

export interface PositionInfo {
  fen: string;
}

export interface Recommendation {
  bestMoveUci: string | null; 
  scoreCp?: number;           
  mateIn?: number;            
  depth?: number;             
  nodes?: number;             
  pv?: string[];              
  engine: EngineKind;         
  tookMs?: number;            
}

export interface Engine {
  readonly kind: EngineKind;
  init(): Promise<void>;
  setOptions(opts: EngineOptions): void;
  analyze(pos: PositionInfo): Promise<Recommendation>;
  requestMove(pos: PositionInfo): Promise<Recommendation>;
  dispose(): Promise<void>;
}
