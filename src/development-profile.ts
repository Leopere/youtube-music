// Evaluate before config/store and before the single-instance lock. Development
// must never migrate the installed app's settings or reuse its Chromium session.
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

if (app && !app.isPackaged) {
  const profile = path.join(
    app.getPath('appData'),
    'YouTube Music Development',
  );
  fs.mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
}
