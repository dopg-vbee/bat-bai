export interface TimerEntry {
  due: number;
  fn: () => void;
  handle: ReturnType<typeof setTimeout> | null;
}

/** Timeouts that can all be frozen, then resumed with exactly the time they had left. */
export class PausableTimers {
  private readonly entries = new Set<TimerEntry>();
  private paused = false;

  set(ms: number, fn: () => void): TimerEntry {
    const entry: TimerEntry = { due: Date.now() + Math.max(0, ms), fn, handle: null };
    this.entries.add(entry);
    if (!this.paused) this.arm(entry);
    return entry;
  }

  clear(entry: TimerEntry | null): void {
    if (!entry) return;
    if (entry.handle) clearTimeout(entry.handle);
    this.entries.delete(entry);
  }

  clearAll(): void {
    [...this.entries].forEach((entry) => this.clear(entry));
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    for (const entry of this.entries) {
      if (entry.handle) clearTimeout(entry.handle);
      entry.handle = null;
    }
  }

  /** `shiftMs` = how long the pause lasted; every deadline moves back by that much. */
  resume(shiftMs: number): void {
    if (!this.paused) return;
    this.paused = false;
    for (const entry of this.entries) {
      entry.due += shiftMs;
      this.arm(entry);
    }
  }

  private arm(entry: TimerEntry): void {
    entry.handle = setTimeout(() => {
      this.entries.delete(entry);
      entry.fn();
    }, Math.max(0, entry.due - Date.now()));
  }
}
