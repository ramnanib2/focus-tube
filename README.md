# Focus Tube

A Chrome desktop extension with named focus profiles. Each profile has its own channel list and channel checkboxes. Focus mode shows videos only from the checked channels in the active profile. You can add channels by name, handle, URL, or a multi-select subscriptions picker. YouTube Home includes thumbnail shortcuts to the enabled channels. There is no topic filter, AI matching, or discovery from other creators.

## Install locally

1. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this `channel-focus-extension` folder, which contains `manifest.json`.
4. Pin **Focus Tube** using your browser’s Extensions menu.
5. Open the extension → **Manage profiles & channels**.
6. Add channel URLs or `@handles`. Start with a few channels you know you want.
7. Reload any YouTube tabs that were open before installation.

No installation command, API key, account, or build step is required. To install from the ZIP, extract it first and select the extracted folder containing `manifest.json`.

To update an existing unpacked installation, click **Reload** on Focus Tube at `chrome://extensions`, then reload its manager and any open YouTube tabs. Profiles are retained. Version 1.4.2 adds a bundled privacy policy, privacy links, and the padded store icon. The publishing materials are in `publishing/`. Version 1.4.1 shortens the standard-mode typing passage to 2–3 brief sentences (10–15 words) and shows progress against the actual word count. Version 1.4.0 renamed the extension to **Focus Tube** and adds the selected text-free Focus Frame logo to the toolbar, extension listing, page tabs, manager, popup, and typing screen. The interface logo adapts to light and dark mode. Keep the same unpacked folder when updating so your browser extension ID and saved profiles are retained.

## Profiles

- Create, rename, duplicate, and delete profiles. Keep at least one profile.
- Select a profile in the popup or manager. Selection immediately returns all supported YouTube tabs to Focus mode using that profile.
- Add channels by `@handle`, channel ID, or channel URL. Type a freeform channel name to search YouTube, then choose the matching channel. Handles and URLs are verified directly; a display name is never automatically treated as a unique identity.
- The channel picker automatically loads a scrollable subscriptions list from the YouTube account signed in **in the same browser where this extension is installed**. Keep a YouTube tab open and reload it after an extension update. Use **Refresh list** after signing in. Freeform name searches appear in the same picker; **Back to subscriptions** restores the subscription list.
- Search within the subscriptions list, select several channels, and choose **Add selected channels**. Selections survive searching/filtering. Only checked channels are added, already enabled channels are marked, and existing profile channels are preserved. This does not change your YouTube subscriptions.
- The subscriptions reader follows available continuation pages. The fetched list is held only in extension session storage; selection lists expire after 30 minutes. Refresh the list after changing accounts or subscriptions.
- Check or uncheck channels independently in each profile. Unchecked channels stay saved in that profile.
- A profile with no selected channels shows no video recommendations. It never falls back to standard mode.

## Standard mode

Click **Switch to standard mode** in the popup, manager, or YouTube toolbar. Type the complete newly generated **2–3 sentence passage** (10–15 words). Capitalization and repeated whitespace are ignored; punctuation must match. Paste and drop are disabled in the typing field.

The service worker validates the current challenge. A challenge expires after 30 minutes, becomes invalid when a new one is generated, and can be used once. Opening another unlock screen replaces the previous screen’s challenge. A fresh attempt has a different passage from the preceding attempt.

Choose 15, 30, or 60 minutes. Standard mode applies to all supported YouTube tabs. Return to Focus instantly with the toolbar, popup, or manager. Focus returns automatically when the break expires, the browser restarts, the extension reloads, or you switch profiles. Timing uses an expiry timestamp as well as a browser alarm, so worker suspension does not keep a break open.

The typing requirement is intentional friction. It does not prevent someone from disabling the extension or automating text entry.

## YouTube behavior

- Filters Home, search results, subscription feeds, supported channel grids, watch-page recommendations, and supported playlist rows.
- Supports classic YouTube renderers and the current `yt-lockup-view-model` cards.
- Keeps native ranking among the cards that pass the filter. This extension filters the recommendations YouTube provides; it does not change YouTube’s recommendation algorithm or synthesize a new feed.
- Unknown channel identities remain hidden. Handle URLs are resolved to channel IDs; names are never used to decide eligibility.
- Direct video URLs are checked against that exact video’s channel before revealing the watch player. Playback is paused while blocked or unverified. Allowed videos may require pressing Play after verification.
- **Approved channel pages keep their native tabs and content**, including Home, Videos, Playlists, Shorts, Posts, Live, and Courses, along with native sorting controls. Playlists and posts curated by that channel remain visible even if they link to another creator. Opening an individual video still verifies its actual uploader.
- “Hide Shorts in feeds” controls discovery shelves outside approved channel pages. An approved channel’s Shorts tab stays available even with that option enabled. Verified Shorts from approved creators open in the regular watch player; the unchecked endless Shorts feed stays blocked.
- On feeds and unapproved channel pages, mixed playlists, radio mixes, community posts, and recommendation chips remain hidden. Unchecked end-screen suggestions and thumbnail previews stay hidden in Focus mode. Individual videos in supported playlist rows are checked separately.
- Blocks the player’s “next video” button in Focus mode. End-screen suggestions are hidden. It does not change your saved YouTube autoplay setting.
- If a filtered feed is empty, browse the selected channels through the links in the empty state.
- On Home in Focus mode, **Your channels** displays each enabled channel’s avatar and a link to its uploads. It updates with the active profile and checkbox selection, remains useful when recommendations are empty, and disappears in standard mode. If an avatar cannot load, the channel’s initials remain as a clickable fallback.
- Hover previews and thumbnail animations do not revoke a card’s verified status. Recycled cards are rechecked when their video, uploader, or Shorts identity actually changes. Avatar refreshes do not reset the video filter.

## Privacy and permissions

Permissions are `storage`, `alarms`, and access to `https://www.youtube.com/*` / `https://youtube.com/*`. Host access is used to modify YouTube pages and fetch channel/video metadata from YouTube. When you open the profile manager, the extension reads your subscriptions using an existing YouTube tab’s signed-in session. It does not copy cookies, request a cookies permission, or request general browsing history. It never clicks Subscribe or Unsubscribe.

Profiles, selected channel thumbnails, settings, and the last generated passage are stored locally in the browser. The last passage prevents repeating it on the next attempt, including after a restart. Your typed response is not saved. Temporary break/challenge state and fetched selection lists use extension session storage. Channel/video verification uses in-memory caches. There is no analytics, server, advertising SDK, external font, or remote executable code. YouTube receives ordinary page, search, and subscription-list requests; channel avatars load from YouTube’s image hosts.

## Practical limits

This is a desktop YouTube extension, not a mobile-app blocker. YouTube changes its page layouts and subscription endpoints; unfamiliar formats may need updates. Metadata can be unavailable because of network problems, regional consent pages, or sign-in/age restrictions. Such videos stay blocked or hidden. Channel verification requests use public, signed-out metadata, so private or otherwise restricted videos may not be verifiable even if your current account can watch them. Subscription requests use the signed-in session of the YouTube tab selected by the extension; refresh after switching accounts.

The extension filters recommendation surfaces, not in-stream advertisements or links appearing in video content. Disabling the extension restores ordinary YouTube. Reload open YouTube tabs after updating an unpacked installation to reconnect the content script.

## Development and checks

Requires Node.js 20+ for checks. No npm dependencies are used.

```sh
npm test
npm run check
npm run package
```

`npm test` covers profile isolation, input validation, metadata parsing, subscription catalogs, safe thumbnails, bulk-add validation, concurrent settings writes, challenge freshness/short sentence limits, stale/replayed challenges, mode expiry, and restart behavior. Browser verification exercises the actual unpacked extension and synthetic YouTube pages; public YouTube smoke checks verify channel resolution and live layout compatibility. See `output/playwright/verification.md` for the original checks and `output/playwright/verification-v1.1.md` for subscriptions, Home shortcuts, and live hover/click verification.

Version 1.4.1 checks are recorded in `output/playwright/verification-v1.4.1.md`, covering 2–3 sentence generation, dynamic progress, and the shorter unlock flow.

Version 1.4 checks are recorded in `output/playwright/verification-v1.4.md`, covering the Focus Tube name, logo loading, light/dark presentation, Chrome icon assets, and retained profile storage.

Version 1.3 checks are recorded in `output/playwright/verification-v1.3.md`, covering the inline subscription picker, freeform name/handle entry, profile isolation, removed backup actions, and neutral light/dark responsive layouts.

Version 1.2 checks are recorded in `output/playwright/verification-v1.2.md`, covering fixed-header clipping, responsive layouts, native channel tabs, profile/route changes, and verified Short playback.

The package command requires Python 3 and writes `output/focus-tube-extension.zip`, containing only runtime files and this README. It excludes tests, browser profiles, screenshots, and development artifacts.

## Files

- `src/core.js`: shared pure logic, URL validation, metadata parsing, challenge generation.
- `src/background.js`: single settings writer, channel verification, one-use challenge verification, mode coordination.
- `src/content.js`, `src/content.css`: YouTube filtering, playback guard, page toolbar.
- `app.html`, `popup.html`, `unlock.html` and their scripts: profile manager, browser popup, typing gate.
- `assets/branding/focus-tube.svg`: theme-aware vector logo; the selected original PNG is retained as a design reference.
- `assets/icons/`: browser icons at 16, 24, 32, 48, and 128 pixels, with a neutral backing for toolbar contrast.
- `tests/`: dependency-free Node tests.

## Publishing

See `publishing/README.md` for store listing copy, privacy/permission explanations, reviewer instructions, five current screenshots, the padded icon, and a hostable privacy policy. `privacy.html` is also bundled in the extension and linked from the manager, popup, and typing screen. The public privacy policy is hosted at https://ramnanib2.github.io/focus-tube-privacy/privacy.html. Use that URL in the Store privacy field; developer account details still need to be configured before submission.
