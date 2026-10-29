# I’m Feeling Lucky

Restore the one-click listening experience the owner remembers from Google Play Music: press **I’m Feeling Lucky** and immediately hear a fresh, personalized mix without choosing a song, artist, or playlist first.

## Repository and installed app

The installed `/Applications/YouTube Music.app` is version 3.11.0, bundle ID `com.github.th-ch.youtube-music`. Its updater points to `th-ch/youtube-music`, which now redirects to `pear-devs/pear-desktop`. This checkout follows upstream `master` (currently package version 3.12.0), with `origin` at `Leopere/youtube-music` and `upstream` at `pear-devs/pear-desktop`. This is a public GitHub fork; preserve the upstream MIT license and attribution.

## Desired behavior

- A visible, accessible **I’m Feeling Lucky** button starts playback with one click from the app’s usual listening surface.
- Use the signed-in user’s recommendations, personalized mixes, or listening/library context through the existing YouTube Music player integration. Investigate available endpoints and queue actions before choosing the implementation.
- Another press should create a different starting point or mix; simply shuffling the existing queue is insufficient.
- Preserve normal playback controls and queue behavior. Reuse the app’s plugin, settings, localization, and renderer patterns where appropriate.
- Handle signed-out state, missing recommendations, and network errors clearly. Keep the existing queue usable when generating a new mix fails.
- Add meaningful tests for selection, queue replacement, repeated presses, and failure handling. Verify the actual button and playback flow in a development instance when access permits.

## Delivery and current state

The `feeling-lucky` plugin is implemented and enabled by default. The button appears in the navigation bar. Each press fetches the signed-in Home recommendations through the site's existing network manager, chooses a song, checks its `RDAMVM` radio response, and opens the native watch route. The current song and previous start are excluded. Up to five recent starts are avoided when other recommendations exist. This starts a new radio request rather than shuffling the current queue.

The plugin handles signed-out users, missing recommendations, unavailable player APIs, network failures, and request timeouts. It does not clear the existing queue before requesting a mix. Concurrent presses are ignored while a request runs. Disabling the plugin prevents late navigation. No credentials or listening history are copied, logged, or stored by the plugin.

Development Electron instances use `YouTube Music Development` under the OS application-data directory for both settings and Chromium session data. This is selected before the settings store and single-instance lock initialize. Unpackaged instances do not register the installed app's URL protocol or change login-item settings. The installed 3.11.0 app remains separate.

Work directly on `master`; native ship-it hooks own commits and pushes. Do not create a branch or PR unless requested.

The upstream Actions workflow files remain for reference, but GitHub Actions is disabled on this new fork. The trusted `jenkins-local` stack now has a `check-youtube-music` job for exact-revision checks and build artifacts. Its configuration validates, but no run against the feature revision has been observed yet. This does not establish release or deployment acceptance. Establish Jenkins-owned build, tests, artifacts, and live acceptance before releasing changes, using the existing Mac/Jenkins patterns. Target about one minute end to end and jobs below five minutes. Keep local checks useful during development. Do not replace the installed app, change its login/profile, or interrupt its current playback as part of this bootstrap.

## Verification and remaining acceptance

Use Node 24.15.0 or a newer compatible Node release and pnpm 11.1.0. The default Node 24.2.0 fails the locked `node-gyp` engine requirement. `packageManager` pins pnpm to avoid the broken default shim observed on this Mac.

- `pnpm test:lucky`: 12 selection/network/lifecycle tests and 2 button tests pass. Button tests use the real English resource and i18next. Protocol fixtures are synthetic.
- `pnpm typecheck`: passes.
- `pnpm lint`: no errors; existing warnings remain in other plugins.
- `pnpm build`: passes. This is a local development build, not a release artifact.
- Focused formatting checks pass. The whole-source formatter reported inherited failures in unrelated files; those are not represented as a passing full check.
- `pnpm test:lucky:electron`: passes on this Mac after building. It verifies the separate profile, visible localized button, and signed-out feedback, then closes only its development instance.
- Git delivery: native Stop hooks own the next commit and push. The `ci-artifacts-only` handoff submits and observes `check-youtube-music` after a push; it does not publish, install, or claim live acceptance. No new pushed feature revision has been verified in this work session.
- Jenkins: job installed and pipeline configuration validated. A feature-revision run, artifact receipt, run duration, and request-to-result timing remain unverified. The first toolchain-image prewarm took about 3.5 minutes; warm jobs should reuse that image.
- Release: no signed macOS release or installed-app update has been produced or activated. Release destination remains to be chosen. Imported Actions stay disabled/reference; cross-platform releases, signing, vulnerability scanning, and Winget publication have not been replaced and verified.
- Playback: signed-in personalized selection, native queue replacement, and advancing audio have not been verified against a real account. The passing navigation unit test checks the submitted watch URL; it does not prove audio playback.

To finish playback acceptance, the owner must sign in manually in the separate development profile using `pnpm start`, then close that development instance. The primary agent can then run `pnpm test:lucky:playback`. That command launches this checkout, presses the real button twice, checks different starting songs, populated queues, and advancing playback, and closes its development instance. It does not use the installed app's profile or save account responses. The owner should also confirm audible playback and normal controls. If recommendations or playback fail, the primary agent owns diagnosing the failing API boundary and rerunning the affected checks.

TODO: after native shipping provides a pushed feature revision, the primary agent must observe `check-youtube-music` for that exact revision, validate its archived hashes/receipt, and record its duration. Until that run and the signed-in playback check succeed, acceptance remains open.
