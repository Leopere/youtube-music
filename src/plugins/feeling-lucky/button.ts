import { LuckyError } from './mix';

export function mountLuckyButton(
  container: HTMLElement,
  mix: { start(): Promise<boolean>; stop(): void },
  message: (key: string) => string,
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
  button.onclick = async () => {
    if (button.disabled) return;
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
  group.append(button, status);
  container.prepend(group);
  return () => {
    stopped = true;
    mix.stop();
    group.remove();
  };
}
