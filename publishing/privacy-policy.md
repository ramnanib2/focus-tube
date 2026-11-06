# Focus Tube Privacy Policy

Last updated: November 5, 2026. Applies to Focus Tube 1.4.2.

## Overview

Focus Tube is a browser extension that helps you watch YouTube intentionally by filtering supported pages to channels selected in named focus profiles. This policy describes the extension’s current data practices. Focus Tube is independently developed and is not affiliated with or endorsed by YouTube or Google.

## Information processed on your device

Profiles and preferences: profile names, selected channel IDs, names, handles, URLs, avatar URLs, enabled-channel choices, the active profile, and the Shorts preference are stored in Chrome’s local extension storage. Focus Tube does not synchronize these settings through its own service or Chrome Sync.

YouTube page information: the extension reads supported YouTube pages, including video and channel links, uploader information, recommendation cards, and relevant page metadata, to decide which content belongs in your profile. Current YouTube video IDs and channel identifiers are used for verification. Focus Tube does not request general browser history access or track activity on unrelated websites.

Subscriptions and searches: when the profile manager loads its inline subscriptions list, Focus Tube asks an existing YouTube tab to request your subscription list using that tab’s signed-in YouTube session. It processes channel IDs, names, handles, avatar URLs, account-selection context, and pagination data. Typing a channel name sends a search query to YouTube; entering a handle or URL requests the matching channel page. Selecting channels changes only Focus Tube’s local profiles, not your YouTube subscriptions.

Standard-mode typing: the generated passage, its challenge ID and creation time, the previous generated passage, and a temporary break-expiry time are processed to manage intentional switching. Your typed answer is processed in the typing screen and sent to the extension’s local background worker for comparison; the answer is not persistently saved or transmitted to the developer. The previous generated passage is saved locally to prevent an immediate repeat.

## Network requests and third parties

Focus Tube makes HTTPS requests to YouTube to search channels, read subscriptions, and verify channel and video ownership. Channel avatars load from YouTube image services, including yt3.ggpht.com, yt3.googleusercontent.com, and i.ytimg.com. YouTube and these Google-operated services receive ordinary request information such as your IP address, requested URL, and normal browser headers. Signed-in subscription requests also use session credentials automatically attached by your browser.

Focus Tube does not read, copy, export, or send cookie values, passwords, or OAuth tokens to the developer. It does not create a separate Focus Tube account. The developer does not operate a backend that receives your profiles, subscription list, viewing activity, searches, or typed passage answers. There is no analytics SDK, advertising SDK, telemetry endpoint, or data broker integration in the extension.

YouTube and Google process requests under their own privacy policies. If you visit a hosted copy of this policy or contact support, the hosting or communications provider may process ordinary page-request or message information. This policy page contains no analytics, tracking scripts, or remote fonts.

## Use and sharing

Data is used only to provide channel filtering, profile management, subscription selection, channel shortcuts, and deliberate temporary access to standard YouTube. Focus Tube does not sell user data or use it for advertising, credit decisions, or unrelated profiling. The developer does not receive extension usage data and cannot access your local profiles through a developer dashboard.

If you voluntarily contact support, information you choose to include in that correspondence is used to respond and resolve your request, retained only as needed for that purpose or applicable obligations, and handled through the contact provider you use. Do not send passwords, cookies, or account tokens.

## Storage and retention

Saved profiles, preferences, avatar URLs, and the previous generated passage remain in local extension storage until you edit or remove them, clear the extension’s storage, or uninstall the extension. Chrome controls how uninstalling and browser-profile deletion remove extension storage.

Subscription and channel-search catalogs are held in extension session storage. A catalog expires for channel selection after 30 minutes; expiry does not itself immediately erase the stored record. Catalogs are replaced as new lists are fetched and are cleared when the browser session ends or the extension reloads. Active challenges and break timing also use session storage. Channel and video verification caches live in the extension’s memory and are discarded when its background worker or page context ends.

## Your choices

You can add, disable, or remove channels; rename or delete profiles; and change the Shorts preference. At least one profile is kept by the interface. To erase all saved extension data, clear Focus Tube’s extension storage or uninstall it. You can switch YouTube accounts and refresh the subscriptions list, or use direct channel entry without using the subscription picker. Disabling or uninstalling Focus Tube stops its filtering and future requests.

Focus Tube only filters supported desktop YouTube surfaces. Its typing requirement is a pause before switching modes, not a restriction against disabling the extension.

## Permissions

Storage saves profiles, preferences, temporary catalogs, and switching state. Alarms return timed standard-mode breaks to Focus mode. Access to youtube.com and www.youtube.com lets Focus Tube read and filter supported YouTube pages and request channel, video, and subscription metadata. These permissions do not grant Focus Tube access to every website.

## Limited Use

Focus Tube’s use of information received from Google services adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements. Information is used only for the extension’s disclosed features and is not sold or used for personalized advertising.

## Changes and contact

This policy will be updated when Focus Tube’s data practices change. Material changes will also be disclosed in the extension before new data practices take effect. For privacy questions or support, use the developer support contact shown on the Focus Tube Chrome Web Store listing.

Google Privacy Policy: https://policies.google.com/privacy

Chrome Web Store User Data Policy: https://developer.chrome.com/docs/webstore/program-policies/limited-use
