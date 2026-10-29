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

The `feeling-lucky` plugin is implemented and enabled by default. The button appears in the navigation bar. Each press fetches the signed-in Songs library (`FEmusic_liked_videos`) through the site's existing network manager, chooses a saved song, checks its `RDAMVM` radio response, and opens the native watch route. General Home shelves, Trending, charts, and seasonal promotions are not seed sources. If the library has no eligible song, the app asks the user to save more songs instead of substituting generic recommendations. The current song and previous start are excluded. Up to five recent starts are avoided when other recommendations exist. This starts a new radio request rather than shuffling the current queue.

The plugin handles signed-out users, missing recommendations, unavailable player APIs, network failures, and request timeouts. It does not clear the existing queue before requesting a mix. Concurrent presses are ignored while a request runs. Disabling the plugin prevents late navigation. No credentials or listening history are copied, logged, or stored by the plugin.

Development Electron instances use `YouTube Music Development` under the OS application-data directory for both settings and Chromium session data. This is selected before the settings store and single-instance lock initialize. Unpackaged instances do not register the installed app's URL protocol or change login-item settings. The installed 3.11.0 app remains separate.

Work directly on `master`; native ship-it hooks own commits and pushes. Do not create a branch or PR unless requested.

The upstream Actions workflow files remain for reference, but GitHub Actions is disabled on this new fork. The trusted `jenkins-local` stack now has a `check-youtube-music` job for exact-revision checks and build artifacts. Its configuration validates, but no run against the feature revision has been observed yet. This does not establish release or deployment acceptance. Establish Jenkins-owned build, tests, artifacts, and live acceptance before releasing changes, using the existing Mac/Jenkins patterns. Target about one minute end to end and jobs below five minutes. Keep local checks useful during development. Do not replace the installed app, change its login/profile, or interrupt its current playback as part of this bootstrap.

## Verification and remaining acceptance

Use Node 24.15.0 or a newer compatible Node release and pnpm 11.1.0. The default Node 24.2.0 fails the locked `node-gyp` engine requirement. `packageManager` pins pnpm to avoid the broken default shim observed on this Mac.

- `pnpm test:lucky`: 27 focused tests pass, including library selection, button behavior, startup, explicit player start, and the focused listening view. Button tests use the real English resource and i18next. Protocol fixtures are synthetic.
- `pnpm typecheck`: passes.
- `pnpm lint`: no errors; existing warnings remain in other plugins.
- `pnpm build`: passes. This is a local development build, not a release artifact.
- Focused formatting checks pass. The whole-source formatter reported inherited failures in unrelated files; those are not represented as a passing full check.
- `pnpm test:lucky:electron`: passes on this Mac after building. It verifies the separate profile, visible localized button, signed-out feedback, and closing the window without destroying it, then closes only its development instance.
- Git delivery: native Stop hooks own the next commit and push. The `local-macos` handoff submits and observes `deploy-youtube-music` after a push; Jenkins builds, archives, installs and checks the authorized local target. No new pushed feature revision has been verified in this work session.
- Jenkins: the local deployment job is installed and its pipeline configuration validated; the scoped SSH callback was checked to reject an invalid contract before any activation. A feature-revision run, artifact receipt, run duration, and request-to-result timing remain unverified. The first toolchain-image prewarm took about 3.5 minutes; warm jobs should reuse that image.
- Release: no signed macOS release or installed-app update has been produced or activated. The authorized local target is `/Applications/YouTube Music.app`; public distribution remains out of scope. Imported Actions stay disabled/reference; cross-platform releases, signing, vulnerability scanning, and Winget publication have not been replaced and verified.
- Playback: signed-in personalized selection, native queue replacement, and advancing audio have not been verified against a real account. The passing navigation unit test checks the submitted watch URL; it does not prove audio playback.

The authorized upgrade uses the installed profile directly. It does not require signing into the separate development profile first. Jenkins checks retained sign-in, automatic playback, two different manual Lucky starts and playback after hiding the window. The independent `pnpm test:lucky:playback` command remains available for an optionally signed-in development profile. The primary agent owns diagnosing a failed API or authentication boundary; the deployment controller restores the previous app/profile if live acceptance fails.

TODO: after native shipping provides a pushed feature revision, the primary agent must observe `deploy-youtube-music` for that exact revision, validate its installed-app and archived artifact receipt, and record its duration. Until that run and the signed-in playback check succeed, acceptance remains open.


## Launch and local upgrade request

The owner authorized switching the installed app to this fork on 2026-10-29, reusing the existing sign-in, and asked for launch-to-music and close-to-menu-bar behavior. This supersedes the earlier bootstrap restriction against replacing the installed app. Profile contents must still remain private and out of Git, Jenkins artifacts, and logs.

`playOnLaunch` defaults to true and can be turned off in the Feeling Lucky plugin settings. A bounded startup attempt waits for the authenticated player, then uses the same library-based mix action as the button. It does not trigger again when a hidden window is reopened or the plugin is re-enabled. Existing playback or the Disable Autoplay plugin suppresses automatic startup.

New profiles enable the tray/menu-bar icon and disable restoring an old queue and upstream automatic updates. The authorized local migration sets those preferences in the existing profile while preserving other settings. Closing the window hides it and leaves playback alive; the menu-bar icon restores the window and its Quit command exits the app.

The Jenkins-owned local update targets `/Applications/YouTube Music.app`, preserves its bundle ID and product name, and uses its existing `YouTube Music` profile. The previous app and a quiescent profile backup must be kept privately before replacement. The controller must verify the requested installed revision, retained sign-in, automatic advancing playback, and playback after hiding the window. A failed check restores the previous app and profile. Local ad-hoc signing matches the existing signing family; this is not a notarized public release. Sign-in continuity remains unverified until that acceptance check actually succeeds.


## Focused listening follow-up

The owner also requested a menu-bar app without a Dock icon and a Home view without generic promotional carousels. `menuBarOnly` now defaults to true when the tray is enabled. Disabling the tray restores Dock access. Home and the watch route show a focused listening panel with a large Lucky button; Search and Library retain the native interface. The `focusHome` plugin option restores native Home content when disabled.

Jenkins build 1 completed checks and packaging but failed a premature signature check before activation. The controller now signs before verifying and reuses the validated package for the same frozen source. Builds 2 and 3 retained the real sign-in and generated a populated library radio queue, but the embedded player stayed unstarted; both attempts restored the old app/profile. The feature now explicitly calls the player API for the selected song after navigation, with cancellation and a bounded wait. This corrected source still requires a new pushed-revision Jenkins acceptance run.
