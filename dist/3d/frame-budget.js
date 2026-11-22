// Use elapsed display frames instead of CPU submission time. An overloaded
// GPU can have a fast JavaScript submission but still miss the next refresh.
export class FrameBudget {
  constructor() {
    this.scale = 1;
    this.fps = null;
    this.seconds = 0;
    this.frames = 0;
    this.stableWindows = 0;
  }

  observe(seconds, adapt) {
    if (!adapt) {
      this.scale = 1;
      this.stableWindows = 0;
    }
    if (seconds <= 0 || seconds > .22) {
      this.seconds = 0;
      this.frames = 0;
      return;
    }
    this.seconds += seconds;
    this.frames++;
    if (this.seconds < .999999) return;

    this.fps = this.frames / this.seconds;
    this.frames = 0;
    this.seconds = 0;
    if (!adapt) return;

    if (this.fps < 51) {
      this.scale = Math.max(.64, Math.round(this.scale * .89 * 100) / 100);
      this.stableWindows = 0;
    } else if (this.fps >= 57.7) {
      if (++this.stableWindows >= 3) {
        this.scale = Math.min(1, Math.round((this.scale + .07) * 100) / 100);
        this.stableWindows = 0;
      }
    } else {
      this.stableWindows = 0;
    }
  }
}
