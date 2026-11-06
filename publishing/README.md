# Focus Tube publishing kit

Prepared November 5, 2026 for version 1.4.2. The privacy policy is hosted on GitHub Pages. The extension has not been submitted to the Chrome Web Store.

## Upload map

| Dashboard field | Prepared asset |
| --- | --- |
| Extension package | `focus-tube-extension.zip` at the kit root (workspace: `../output/focus-tube-extension.zip`) |
| Store listing | `store-listing.txt` |
| Privacy practices and permission justifications | `privacy-practices.md` |
| Reviewer test instructions | `reviewer-instructions.txt` |
| Store icon | `icons/focus-tube-store-128.png` |
| Screenshots | Five numbered PNG files in `screenshots/` |
| Privacy policy source | `privacy-policy.md` |
| Hostable privacy policy | `site/privacy.html` (also `site/index.html`) |

The 128x128 PNG contains 96x96 square artwork and exactly 16 transparent pixels of outer padding on each side. It is also included in the extension as `assets/icons/icon-128.png`. Smaller toolbar icons retain their existing larger artwork for readability. The SVG source is provided in `icons/`.

## Screenshots

All five images are 1280x800, square-cornered, full-bleed captures of the actual extension UI. Example profiles use publicly available channels verified through the normal extension flow. Public name-search results and signed-out YouTube are live, not simulated. No personal subscriptions, user credentials, or private account data are used. The list shown is the real freeform channel-search picker, not a fabricated signed-in subscription list.

Suggested upload order and captions:
1. `01-profiles-and-channel-search.png` — Create separate profiles for the channels you choose.
2. `02-inline-channel-picker.png` — Search channels and select several in the inline picker.
3. `03-youtube-home-channel-shortcuts.png` — Open your enabled channels from YouTube Home.
4. `04-short-standard-mode-passage.png` — A short pause before standard YouTube.
5. `05-enabled-channels-dark-mode.png` — Control each channel and follow your system theme.

Do not use earlier development screenshots with the old name, green theme, 50-word passage, or layout fixtures.

## Hosted privacy policy

Chrome Web Store privacy policy URL: https://ramnanib2.github.io/focus-tube-privacy/privacy.html

Source repository: https://github.com/ramnanib2/focus-tube-privacy

Pages publishes the `main` branch, repository root, with HTTPS enforced. Update both `privacy.html` and `index.html` in that repository when the policy changes. Keep the bundled extension policy and disclosures consistent.

### Source files and alternative hosting

Upload the contents of `site/` to your HTTPS static host. This can be an existing website or a GitHub Pages site. Both HTML files are self-contained: no scripts, fonts, build process, or analytics are needed. The privacy URL must open publicly without sign-in. Add its actual URL to the Store privacy field. The bundled extension copy is `../privacy.html`; its chrome-extension:// address is not suitable for that field.

The policy currently identifies Focus Tube as the product and directs privacy questions to the developer support contact on the Store listing. Set a real verified public support email in the Developer Dashboard. If a named publisher or direct email is preferred, update the contact paragraph in all policy copies before hosting and repackaging. No identity or email has been invented.

## Finish in the Developer Dashboard

1. Register your developer account, verify your contact email, enable Google 2-Step Verification, and complete any account/region verification the Dashboard requests.
2. Use the hosted privacy URL above in the Store privacy field. Set your actual publisher name and verified support email.
3. Add a new item and upload the extension ZIP, not this entire publishing kit.
4. Paste the prepared listing text, choose the available productivity/focus category and English language, and upload the icon and screenshots.
5. Complete privacy practices using the provided explanations and current Dashboard definitions. Do not claim that no user data is handled: local profiles, YouTube page content/URLs, subscriptions, and typed switching responses are processed for the disclosed features.
6. Add test instructions, select distribution (Unlisted is useful for an initial test release), and submit for review when ready. Approval and review duration are controlled by Google.

Keep the current unpacked extension folder when testing updates. A separate Store installation normally has a different extension ID/storage area from the unpacked development copy; do not assume its local profiles will automatically migrate. The publishing ZIP and kit contain no personal profile data.

## Checked official references

- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions
- https://developer.chrome.com/docs/webstore/publish
