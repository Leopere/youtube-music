// Keep Home focused on listening. Other routes retain the site's native UI.
export function createListeningView(
  navigation: HTMLElement,
  control: HTMLElement,
  message: (key: string) => string,
) {
  const panel = document.createElement('section');
  panel.id = 'feeling-lucky-home';
  panel.setAttribute('aria-labelledby', 'feeling-lucky-home-title');
  const heading = document.createElement('h1');
  heading.id = 'feeling-lucky-home-title';
  heading.textContent = message('home-title');
  const description = document.createElement('p');
  description.textContent = message('home-description');
  panel.append(heading, description);
  const hidden = new Map<HTMLElement, HTMLElement['hidden']>();

  const restore = () => {
    for (const [element, wasHidden] of hidden) {
      element.hidden = wasHidden;
      element.removeAttribute('data-lucky-suppressed');
    }
    hidden.clear();
    if (control.parentElement !== navigation) navigation.prepend(control);
    panel.remove();
  };

  return {
    update(enabled: boolean, pathname: string) {
      if (!enabled || (pathname !== '/' && pathname !== '/watch')) {
        restore();
        return;
      }
      const response = document.querySelector<HTMLElement>(
        'ytmusic-browse-response',
      );
      if (!response?.parentElement) return;
      if (panel.parentElement !== response.parentElement) {
        response.before(panel);
      }
      if (control.parentElement !== panel) panel.append(control);
      if (!hidden.has(response)) hidden.set(response, response.hidden);
      if (!response.hidden) response.hidden = true;
      if (!response.hasAttribute('data-lucky-suppressed'))
        response.setAttribute('data-lucky-suppressed', '');
    },
    stop: restore,
  };
}
