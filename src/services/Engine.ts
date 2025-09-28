export type UciListener = (line: string) => void;

export interface IEngine {
  start(): Promise<void>;
  send(cmd: string): void;       
  onMessage(cb: UciListener): void;
  stop(): void;
}
