# Dropbox — Kittl Extension

A Kittl extension that connects to your Dropbox account and lets you browse and add images directly to the Kittl canvas.

> **Tip:** If you use the Dropbox mobile app to save photos or files from your phone, they'll show up here — making it easy to get assets from your phone onto the Kittl canvas without any extra steps.

## Features

- **OAuth via Kittl auth** — connects with Dropbox using the Kittl SDK's built-in auth system; tokens are stored server-side and persist across devices and browsers
- **File browser** — navigate folders, open subfolders, and use the back button to go up
- **Hide folders mode** — flattens your entire Dropbox into a single list of canvas-supported files, sorted by most recently modified
- **Thumbnails with shimmer** — lazy-loaded in batches as you scroll; shows an animated shimmer placeholder while thumbnails load
- **Add to canvas** — click any supported image to add it to the Kittl canvas at the center of the viewport
- **Export to Dropbox** — select any element or artboard on the canvas and export it as a 2× PNG directly to `/Kittl Exports/` in your Dropbox
- **Infinite scroll** — files load in pages of 40 as you scroll, keeping the UI fast even with large libraries
- **Dropbox Business support** — automatically resolves the user's home namespace for team accounts
- **Empty states** — friendly empty state and connect screen with the Dropbox logo

## Supported file types

| Action | Formats |
|---|---|
| Add to canvas | `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg` |
| Thumbnail preview | All image and video files (Dropbox API decides) |
| Export from canvas | `png` (2× resolution) |

## Project structure

```
src/
  App.tsx                   Root component — layout only
  constants.ts              Shared constants (provider key, page size, storage keys)
  styles.css                All styles using Kittl design tokens
  assets/
    icon-dropbox-mark.svg   Dropbox diamond mark (no background) for UI
  hooks/
    useDropbox.ts           All state, effects, and callbacks
  components/
    Header.tsx              Title bar, back button, kebab menu
    FileCard.tsx            Individual file/folder card with shimmer + thumbnail
    FileGrid.tsx            Scroll container + grid
    ConnectPanel.tsx        Pre-auth screen with logo and connect button
    EmptyState.tsx          Empty folder / no files state
    ExportFooter.tsx        Sticky footer shown when canvas objects are selected
  lib/
    dropbox.ts              Dropbox API functions (list, thumbnail, upload, export)
    fileHelpers.ts          File extension helpers
public/
  icon-dropbox.svg          App icon (blue background, used in Kittl extension store)
```

## Setup

### 1. Register a Dropbox app

1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) and create a new app
2. Choose **Full Dropbox** access
3. Enable permissions: `files.metadata.read`, `files.content.read`, `files.content.write`, `account_info.read`
4. Add the Kittl auth callback as a redirect URI:
   ```
   https://app.kittl.com/auth/callback/{your-kittl-app-id}
   ```

### 2. Configure the manifest

Update `manifest.json` with your Dropbox app's client ID:

```json
"oauthProviders": {
  "dropbox": {
    "clientId": "YOUR_DROPBOX_APP_KEY",
    ...
  }
}
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Run locally

```bash
pnpm dev
```

### 5. Upload to Kittl

```bash
pnpm build
kittl app upload
```

> **Note:** Any time you change OAuth scopes in `manifest.json`, bump the version and redeploy. Existing users will need to disconnect and reconnect to get a new token with the updated permissions.

## How the mobile workflow works

1. Open the **Dropbox app** on your phone (iOS or Android)
2. Upload or save any photo or file to your Dropbox
3. Open **Kittl** on your desktop and launch the **Dropbox extension**
4. Your file appears in the browser immediately — click to add it to the canvas

No USB connection, no email, no AirDrop. Dropbox syncs in seconds.

## Tech stack

- **React 19** + **Vite**
- **Kittl SDK** (`@kittl/sdk`) — canvas integration, auth, export, and selection state
- **Kittl UI** (`@kittl/ui-react`, `@kittl/ui-icons`, `@kittl/ui-tokens`) — components and design tokens
- **Dropbox API v2** — file listing, thumbnails, temporary download links, file upload
