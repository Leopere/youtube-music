import { LuckyError } from './mix';

export function mountLuckyButton(
  container: HTMLElement,
  mix: { start(): Promise<boolean>; stop(): void },
  message: (key: string) => string,
  onManualStart: () => void = () => {},
) {
  const group = document.createElement('div');
  group.id = 'feeling-lucky';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = message('button');
  button.title = message('description');
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  let stopped = false;
  const start = async () => {
    if (stopped || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.textContent = message('loading');
    try {
      const started = await mix.start();
      if (!stopped) status.textContent = started ? message('started') : '';
    } catch (error) {
      if (!stopped) {
        status.textContent = message(
          error instanceof LuckyError ? error.code : 'network',
        );
      }
    } finally {
      if (!stopped) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  };
  button.onclick = () => {
    onManualStart();
    return start();
  };
  group.append(button, status);
  container.prepend(group);
  return {
    element: group,
    start,
    stop() {
      stopped = true;
      mix.stop();
      group.remove();
    },
  };
}
