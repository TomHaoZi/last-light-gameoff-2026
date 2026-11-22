// Use elapsed display frames instead of CPU submission time. An overloaded
// GPU can have a fast JavaScript submission but still miss the next refresh.
export class FrameBudget {
  constructor() {
    this.scale = 1;
    this.resetMeasurement();
  }

  resetMeasurement() {
    this.fps = null;
    this.seconds = 0;
    this.frames = 0;
    this.stableWindows = 0;
    this.wasSlow = false;
  }

  observe(seconds, adapt) {
    if (!adapt) {
      this.scale = 1;
      this.stableWindows = 0;
      this.wasSlow = false;
    }
    if (seconds <= 0) return;
    if (seconds > 1.25) {
      this.resetMeasurement();
      return;
    }
    this.seconds += seconds;
    this.frames++;
    if (this.seconds < .999999) return;

    this.fps = this.frames / this.seconds;
    this.frames = 0;
    this.seconds = 0;
    if (!adapt) return;

    // Shader compilation and texture upload may cost an isolated window.
    // Lower resolution only once the slowdown continues into the next one.
    const slow = this.fps < 51;
    if (slow && this.wasSlow) this.scale = Math.max(.64, Math.round(this.scale * .89 * 100) / 100);
    this.wasSlow = slow;
    if (this.fps >= 57.7) {
      if (++this.stableWindows >= 3) {
        this.scale = Math.min(1, Math.round((this.scale + .07) * 100) / 100);
        this.stableWindows = 0;
      }
    } else {
      this.stableWindows = 0;
    }
  }
}
