# Dropbox — Kittl Extension

A Kittl extension that connects to your Dropbox account and lets you browse, search, and add images directly to the Kittl canvas.

## Features

- **OAuth via Kittl auth** — connects with Dropbox using the Kittl SDK's built-in auth system; tokens are stored server-side and persist across devices
- **File browser** — navigate folders, open subfolders, and use the back button to go up
- **All Files mode** — flattens your entire Dropbox into a single list of canvas-supported files, sorted by most recently modified
- **Thumbnails** — lazy-loaded in batches as you scroll; images and videos show previews
- **Add to canvas** — click any supported image to add it to the Kittl canvas at the center of the viewport
- **Infinite scroll** — files load in pages of 40 as you scroll, keeping the UI fast even with large libraries
- **Dropbox Business support** — automatically resolves the user's home namespace for team accounts

## Supported file types

| Action | Formats |
|---|---|
| Add to canvas | `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg` |
| Thumbnail preview | All image and video files (Dropbox API decides) |

## Project structure

```
src/
  App.tsx                 Root component — layout only
  constants.ts            Shared constants (provider key, page size, storage keys)
  styles.css              All styles using Kittl design tokens
  hooks/
    useDropbox.ts         All state, effects, and callbacks
  components/
    Header.tsx            Title bar, back button, kebab menu
    FileCard.tsx          Individual file/folder card
    FileGrid.tsx          Scroll container + grid
  lib/
    dropbox.ts            Dropbox API functions
    fileHelpers.ts        File extension helpers
```

## Setup

### 1. Register a Dropbox app

1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) and create a new app
2. Choose **Full Dropbox** access
3. Enable permissions: `files.metadata.read`, `files.content.read`, `account_info.read`
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
npm install
```

### 4. Run locally

```bash
npm run dev
```

### 5. Upload to Kittl

```bash
kittl app upload
```

## Tech stack

- **React 19** + **Vite**
- **Kittl SDK** (`@kittl/sdk`) — canvas integration and auth
- **Kittl UI** (`@kittl/ui-react`, `@kittl/ui-icons`, `@kittl/ui-tokens`) — components and design tokens
- **Dropbox API** — file listing, thumbnails, temporary download links
