/** Damped spring integrated with semi-implicit Euler at 1/120 s sub-steps. */
export class Spring {
  x: number;
  v = 0;
  target: number;
  constructor(x: number, public k = 170, public c = 26, public m = 1) {
    this.x = x;
    this.target = x;
  }
  set(k: number, c: number) { this.k = k; this.c = c; return this; }
  /** Returns true while still moving. */
  step(dt: number): boolean {
    let rem = Math.min(dt, 1 / 20);
    while (rem > 0) {
      const h = Math.min(rem, 1 / 120);
      const a = (-this.k * (this.x - this.target) - this.c * this.v) / this.m;
      this.v += a * h;
      this.x += this.v * h;
      rem -= h;
    }
    const done = Math.abs(this.x - this.target) < 2e-3 && Math.abs(this.v) < 0.02;
    if (done) { this.x = this.target; this.v = 0; }
    return !done;
  }
  kick(v: number) { this.v += v; }
  snap(x: number) { this.x = x; this.target = x; this.v = 0; }
  get moving() { return Math.abs(this.x - this.target) >= 2e-3 || Math.abs(this.v) >= 0.02; }
}

export const damp = (cur: number, tgt: number, lambda: number, dt: number) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));
