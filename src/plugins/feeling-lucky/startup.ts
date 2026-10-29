// Startup is a bounded, one-shot attempt. Window visibility and later settings
// changes must never restart music the user has paused.
export function scheduleLaunchMix(
  state: () => 'wait' | 'skip' | 'start',
  start: () => void,
  timeoutMs = 30000,
) {
  const deadline = Date.now() + timeoutMs;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    cancelled = true;
    clearTimeout(timer);
  };
  const check = () => {
    if (cancelled) return;
    const next = state();
    if (next === 'skip' || Date.now() >= deadline) {
      cancel();
    } else if (next === 'start') {
      cancel();
      start();
    } else {
      timer = setTimeout(check, 250);
    }
  };
  timer = setTimeout(check, 0);
  return cancel;
}
