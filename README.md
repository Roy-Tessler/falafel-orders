# Falafel Orders

An offline Hebrew web app for taking falafel orders, tracking PayBox and cash payments, and showing sales statistics. It runs in the browser of one Android tablet. It has no server and no runtime dependencies.

The design is in `docs/2026-11-06-falafel-orders-design.md`.

## Run the tests

You need Node 22 or later.

```
npm test
```

## Serve the app locally

Run this command in the project folder, then open http://localhost:8080/ in Chrome.

```
python -m http.server 8080
```

## Deploy to GitHub Pages

The tablet must load the app from an HTTPS address once. After that first load, the app works offline.

1. Create a GitHub repository and push this folder to it.
2. In the repository, open Settings, then Pages.
3. Set the source to "Deploy from a branch", choose `master` (or `main`) and the `/ (root)` folder, and save.
4. Wait for the address `https://<user>.github.io/<repository>/` to appear on the Pages screen.

Any free static host works the same way, for example Netlify or Cloudflare Pages.

## Install on the Android tablet

1. Open the GitHub Pages address in Chrome on the tablet.
2. Open the Chrome menu (three dots) and tap "Add to Home screen" or "Install app".
3. Open the app from the new home screen icon. It opens in full screen, without the browser address bar.

Use only this installed icon. Do not clear Chrome's site data for this address, because the orders live there.

## Update the app

The service worker serves every file from its cache. The tablet does not see your changes until you change the cache name.

1. Change the files you need.
2. In `sw.js`, change `CACHE` to a new value, for example `falafel-v2`.
3. If you added a file, add it to the `FILES` list in `sw.js`.
4. Push the change. If the app opens while the tablet has internet, it downloads the new version. The tablet shows the new version on the next open.

## Data

All data lives only in the tablet's browser storage (IndexedDB). The backup file from the "גיבוי" screen is the only other copy. If the tablet is lost or reset, restore the latest backup file on the new device from the same screen.

The app asks Chrome to keep its storage. If 7 days pass without a backup, the home screen shows a reminder.
