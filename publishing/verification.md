# Publishing verification — Focus Tube 1.4.2

Verified November 5, 2026.

## Package and data audit

Reviewed the Manifest V3 permissions, local/session storage writes, public metadata fetches, signed-in subscription requests, avatar hosts, typing validation, and packaging allowlist against the prepared policy and listing claims. No new host permissions, account, backend, analytics, or profile schema were introduced. The only product changes are privacy access links, a bundled static policy, the 128px store icon, and the patch version.

`npm run check` passes; `npm test` passes all 18 tests. The extension manifest remains restricted to storage, alarms, and the two YouTube host patterns.

## Images

The five numbered screenshots are exactly 1280x800, opaque RGB PNGs with square corners and no added padding or fabricated feature overlays. Each was visually reviewed. They capture the actual unpacked extension, normal public channel metadata/search results, and live signed-out YouTube. Learning and Coding are example profiles in an isolated browser, not exported personal data. The picker screenshot uses channel-name search results; no private subscription list is represented as live account data.

The store icon is 128x128 RGBA. Browser pixel checks confirm non-transparent artwork bounds of x=16..111 and y=16..111, with every pixel outside that area fully transparent. The same PNG is installed at assets/icons/icon-128.png. The neutral backing keeps the chosen logo visible on both light and dark store backgrounds. Smaller toolbar icon sizes are unchanged.

## Browser checks

Seven final checks passed: the typing screenshot keeps its action visible; manager, popup, and typing-screen policy links each open the bundled policy; policy rendering works in light and dark mode; the packaged icon has the required transparent outer area. The policy also fits a 390px viewport and loads no executable scripts, remote images, tracking, or fonts. The hosted HTML copies are byte-identical to the bundled policy. Screenshot dimensions, RGB format, icon copies, short-description length (109 characters), and absence of placeholder identity/URLs in public-facing policy/listing text were checked.

No Chrome Web Store developer account was registered and no store item was uploaded or submitted. After initial kit preparation, the privacy policy was deployed to GitHub Pages at https://ramnanib2.github.io/focus-tube-privacy/privacy.html. The actual verified publisher/support contact still needs to be configured in the Developer Dashboard. These checks do not guarantee store approval.

## GitHub Pages deployment

Verified November 5, 2026: both the public `/privacy.html` URL and site root return HTTP 200 over HTTPS without authentication. The downloaded HTML is byte-for-byte identical to the prepared and bundled policy. Pages serves only policy HTML, `.nojekyll`, and the repository README from `main` at `/`. The site repository is public. Deployment details and the policy checksum are recorded in `deployment.json`.
