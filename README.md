# Britify

Britify is a fast, lightweight Google Chrome extension built with Manifest V3 that automatically redirects US-based shopping and retail websites to their `.co.uk` equivalents.

## Features

- **Automatic Redirects**: Intercepts requests to US domains (e.g., `amazon.com`, `ebay.com`) and seamlessly redirects them to the `.co.uk` version using Chrome's native `declarativeNetRequest` API.
- **Global Master Switch**: A single toggle in the popup to easily enable or disable all redirects at once.
- **Granular Control**: Individual toggle switches for every supported domain, allowing you to customize exactly which sites are redirected.
- **Manifest V3**: Built using the latest modern extension standards, ensuring better security, privacy, and performance.

## Installation (Developer Mode)

Currently, the extension can be loaded manually as an unpacked extension:

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the directory containing the extension files.

## Adding New Sites

To add a new site, simply add a new object to the `sites.json` array. The background script parses this file dynamically to build the rewrite rules.

```json
{
  "id": 13,
  "name": "Example",
  "domain": "example.com",
  "targetDomain": "example.co.uk"
}
```
*Note: Make sure the `id` is unique for every entry, as it is required by the `declarativeNetRequest` API to manage rules.*

## Permissions

- `declarativeNetRequest`: Required to securely intercept and redirect requests at the network level without reading the content of web pages.
- `storage`: Required to save and persist your toggle choices (both the global switch and individual domains).
- `host_permissions`: Specific permissions to intercept traffic purely on the supported domains listed in `manifest.json`.

## Structure

- `manifest.json` — The extension's configuration and permissions.
- `background.js` — The service worker handling `declarativeNetRequest` dynamic rule updates based on storage state.
- `popup.html` & `popup.js` — The user interface that allows you to toggle settings.
- `popup.css` — Styling for the popup interface.
- `sites.json` — The central configuration file mapping domains.
