# Developer Dashboard privacy fields

Applies to the audited Focus Tube 1.4.2 package. These are prepared answers, not a submission or a promise of approval. Keep them aligned with the uploaded code and privacy policy.

## Single purpose

Help users watch YouTube intentionally by filtering supported video recommendations and playback to channels selected in named focus profiles, with deliberate temporary access to standard YouTube.

## Permission justifications

### storage

Stores user-created focus profiles, channel selections and preferences locally in Chrome. Session storage holds temporary subscription/search selection catalogs, the current typing challenge, and timed standard-mode state. The last generated passage is saved locally to prevent an immediate repeat. No Chrome Sync or developer server is used.

### alarms

Schedules the end of a user-selected 15-, 30-, or 60-minute standard-mode break so the extension can restore Focus mode even if its background worker has been suspended.

### Host access: https://www.youtube.com/* and https://youtube.com/*

Reads supported YouTube video/channel links and page metadata to identify uploaders and hide unapproved content; verifies channel and video ownership using YouTube pages; and requests subscription data through an existing signed-in YouTube tab for the inline channel picker. Access is limited to YouTube. It is not used to collect general browsing history or modify subscriptions.

## Remote code

Select: No, I am not using remote code.

All executable extension logic is packaged locally. YouTube responses are parsed as data without evaluating their scripts. Channel avatars are remote images, not executable code.

## Data handling disclosures

Do not say “no user data is handled” merely because processing is local. The extension handles YouTube page content and current video/channel URLs, subscription channel records, user-entered profile/channel selections and search text, and the typing response needed for the local switching feature.

Use the Dashboard’s current definitions when completing its checkboxes. The relevant categories to disclose are Website content (YouTube cards, channel names, links, avatars, and subscriptions) and Web history/browsing activity (current YouTube URLs/video IDs processed for filtering; no general history database or visit timeline is collected). Disclose user-entered profile/search text and local typing verification in the policy. Focus Tube does not monitor unrelated clicks, mouse positions, scroll behavior, or keystrokes outside its own typing field, and has no usage analytics.

No passwords, payment data, health data, precise location, email, or personal identity are requested by the extension. Normal signed-in YouTube requests use browser-attached credentials; the extension does not read or copy cookie values or OAuth tokens. Account-selection context from YouTube is used only to request the matching subscription list. No data is transmitted to the developer.

The certifications that match the current code are: data is not sold/transferred for unrelated purposes; data is used only for the disclosed single purpose; data is not used for creditworthiness/lending. Confirm the exact wording presented in the Dashboard before certifying.

## Privacy policy URL

Use: https://ramnanib2.github.io/focus-tube-privacy/privacy.html

Source repository: https://github.com/ramnanib2/focus-tube-privacy

Host `site/privacy.html` at a public HTTPS URL without sign-in. Put the real URL in the Dashboard. The packaged `privacy.html` is available offline inside the extension, but a chrome-extension:// URL is not a public policy URL.

## Disclosure in the interface

The manager identifies the signed-in subscription source beside the picker. The policy explains that loading the manager automatically reads the list, how local and temporary data is used, and what requests go to Google. An in-product Privacy policy link opens the same complete policy. Evaluate consent requirements against the final release and disclosure wording; do not treat this document as an automatic approval.

## Publisher and contact

Default publisher label: Focus Tube. The policy refers to the developer support contact on the Store listing. Set a real, verified support email in the Dashboard before submission. Replace the policy contact paragraph with a direct email if desired; do not invent contact details.

Sources checked November 5, 2026:
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/program-policies/limited-use
