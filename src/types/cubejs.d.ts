declare module 'cubejs' {
  export default class Cube {
    constructor(state?: unknown);
    static fromString(s: string): Cube;
    static random(): Cube;
    static inverse(alg: string): string;
    static initSolver(): void;
    static scramble(): string;
    move(alg: string): this;
    asString(): string;
    isSolved(): boolean;
    randomize(): this;
    solve(maxDepth?: number): string | null;
    toJSON(): unknown;
  }
}
