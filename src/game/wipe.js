// The scene wipe: the frame is covered, and later uncovered, in square chunks. The chunks go in a
// loose front from left to right, each a little early or late, and each fills in steps
// (a quarter, a half, whole) so the edge of the wipe looks like coarse pixels.
const STEPS = [0.34, 0.67, 1];

export class Wipe {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.raf = 0;
  }
  // mode 'in' covers the frame, 'out' uncovers it. Resolves when done.
  run(mode, ms = 900) {
    cancelAnimationFrame(this.raf);
    const c = this.c;
    const w = (c.width = Math.max(1, Math.round(c.clientWidth)));
    const h = (c.height = Math.max(1, Math.round(c.clientHeight)));
    const size = Math.max(18, Math.round(Math.max(w, h) / 34));
    const cols = Math.ceil(w / size);
    const rows = Math.ceil(h / size);
    // When each chunk starts, as a share of the whole wipe: mostly its column, partly chance.
    const start = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) start[y * cols + x] = (x / cols) * 0.52 + Math.random() * 0.3;
    const grow = 0.18; // how long one chunk takes to fill
    c.classList.add('on');
    const t0 = performance.now();
    return new Promise((done) => {
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const g = this.g;
        g.clearRect(0, 0, w, h);
        g.fillStyle = '#07060b';
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const p = Math.max(0, Math.min(1, (t - start[y * cols + x]) / grow));
            const covered = mode === 'in' ? p : 1 - p;
            if (covered <= 0) continue;
            const k = STEPS[Math.min(STEPS.length - 1, Math.floor(covered * STEPS.length - 1e-6))];
            const s = Math.round(size * k);
            const o = Math.floor((size - s) / 2);
            g.fillRect(x * size + o, y * size + o, s + (k === 1 ? 1 : 0), s + (k === 1 ? 1 : 0));
          }
        }
        if (t < 1) return (this.raf = requestAnimationFrame(frame));
        if (mode === 'in') g.fillRect(0, 0, w, h);
        else c.classList.remove('on');
        done();
      };
      this.raf = requestAnimationFrame(frame);
    });
  }
}
