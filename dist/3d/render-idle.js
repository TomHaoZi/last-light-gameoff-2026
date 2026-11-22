const pending = [];
let scheduled = false;

function schedule() {
  scheduled = true;
  requestAnimationFrame(() => {
    const run = deadline => {
      if (!deadline || deadline.timeRemaining() >= 2) pending.shift()();
      if (pending.length) schedule();
      else scheduled = false;
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run);
    else setTimeout(run, 0);
  });
}

// Share one idle task per frame between texture uploads and shader preparation.
export function waitForRenderIdle() {
  return new Promise(resolve => {
    pending.push(resolve);
    if (!scheduled) schedule();
  });
}
