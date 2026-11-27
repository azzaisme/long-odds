// Thirty-second jump playback: wall-clock time in, simulation ticks out.
import { BALANCE } from './balance.js';
import { step } from './sim.js';

export class Playback {
  constructor(st, jumpYears, startMs, durationMs = BALANCE.playbackMs) {
    this.st = st;
    this.jumpYears = jumpYears;
    this.startMs = startMs;
    this.durationMs = durationMs;
    this.totalTicks = jumpYears * BALANCE.ticksPerYear;
    this.ticksDone = 0;
    this.startYear = Math.floor(st.tick / 4);
    this.destYear = this.startYear + jumpYears;
    this.finished = false;
  }

  targetTick(nowMs) {
    const t = Math.max(0, Math.min(1, (nowMs - this.startMs) / this.durationMs));
    return Math.floor(t * this.jumpYears * 4);
  }

  // Runs every due tick in order. Returns the events of the ticks run this frame.
  advance(nowMs, onTick) {
    if (this.finished) return 0;
    const target = this.targetTick(nowMs);
    let ran = 0;
    while (this.ticksDone < target) {
      const ev = step(this.st);
      this.ticksDone++;
      ran++;
      if (onTick) onTick(ev, this.st);
    }
    if (nowMs - this.startMs >= this.durationMs && this.ticksDone === this.totalTicks) this.finished = true;
    return ran;
  }

  progress(nowMs) {
    return Math.max(0, Math.min(1, (nowMs - this.startMs) / this.durationMs));
  }
}
