# Knack — landing page

A one-page site where people learn about Knack and download the Android APK. Plain HTML, CSS and JavaScript: no build step and no dependencies to install.

| File | What it holds |
| --- | --- |
| `index.html` | All the content and the inline icon sprite (Ionicons, the same set the app uses) |
| `styles.css` | Styles. Colour tokens mirror `mobile/src/lib/theme.ts`, with light and dark mode |
| `main.js` | The download link, QR codes, the interactive Today demo, the calendar and scroll reveals |
| `assets/` | App icon and favicon, copied from `mobile/assets/images` |

## Preview

Open `index.html` in a browser, or serve the folder:

```bash
npx serve landing
```

## The download link

Every Download button and both QR codes point to the current APK:

```
https://github.com/sidonweb/knack-mobile/releases/download/v1.1.0/knack-v1.1.0.apk
```

When you release a new version, update the link in two places:

1. `APK_URL` at the top of `main.js` (used by the QR codes)
2. The `href` on each `data-download` link in `index.html`, so the buttons work even without JavaScript. Find and replace the old URL.

## Hosting

Any static host works. You just point it at this folder.

- **Vercel / Netlify:** import the repo and set the root directory to `landing`. There's no build command.
- **GitHub Pages:** push the folder to a repo, go to Settings → Pages, and serve from the branch and folder that contain `index.html`.
