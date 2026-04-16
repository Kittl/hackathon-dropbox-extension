const API = 'https://api.dropboxapi.com/2';
const CONTENT_API = 'https://content.dropboxapi.com/2';
const NOTIFY_API = 'https://notify.dropboxapi.com/2';

const URL = {
  currentAccount: `${API}/users/get_current_account`,
  listFolder:     `${API}/files/list_folder`,
  listFolderMore: `${API}/files/list_folder/continue`,
  longpoll:       `${NOTIFY_API}/files/list_folder/longpoll`,
  tempLink:       `${API}/files/get_temporary_link`,
  thumbnailBatch: `${CONTENT_API}/files/get_thumbnail_batch`,
  upload:         `${CONTENT_API}/files/upload`,
} as const;

/** A single entry returned by the Dropbox list_folder API. */
export interface DbxEntry {
  /** Discriminator — "file" or "folder". */
  '.tag': 'file' | 'folder';
  name: string;
  path_lower: string;
  /** Stable file/folder ID, survives renames and moves. */
  id: string;
  /** ISO 8601 timestamp of the last server-side modification (files only). */
  server_modified?: string;
}

/**
 * Builds the standard headers for a Dropbox API request.
 * When `nsId` is provided, adds the `Dropbox-API-Path-Root` header so the
 * request operates on that namespace (required for Business/Team accounts).
 */
function dbxHeaders(token: string, nsId?: string | null) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(nsId
      ? { 'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'namespace_id', namespace_id: nsId }) }
      : {}),
  };
}

/**
 * Generic POST helper for Dropbox API endpoints.
 * Parses the response as JSON and throws a user-friendly error on failure.
 * Throws `"401"` specifically on auth errors so callers can trigger reconnect.
 */
async function dbxPost<T = Record<string, unknown>>(
  url: string,
  token: string,
  body: unknown,
  nsId?: string | null,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: dbxHeaders(token, nsId),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    console.error('[Dropbox] non-JSON response:', text.slice(0, 200));
    throw new Error('Could not load files. Please try reconnecting.');
  }
  if (!res.ok) {
    console.error('[Dropbox] API error:', data?.error_summary ?? res.status);
    if (res.status === 401) throw new Error('401');
    throw new Error('Could not load files. Please try reconnecting.');
  }
  return data as T;
}

/**
 * Returns the user's home namespace ID for Dropbox Business/Team accounts.
 * Returns `null` for personal accounts (no namespace needed).
 */
export async function getHomeNamespaceId(token: string): Promise<string | null> {
  const data = await dbxPost<Record<string, unknown>>(
    URL.currentAccount, token, null,
  ).catch(() => null);
  return (data?.root_info as Record<string, string>)?.home_namespace_id ?? null;
}

/**
 * Async generator that streams Dropbox folder entries page by page.
 * Yields the first page immediately so the UI can render without waiting
 * for the full listing to complete (important for large Dropbox accounts).
 *
 * When the full listing is complete (`has_more: false`), calls `onCursor`
 * with the final cursor so callers can use it for longpoll change detection.
 *
 * @param path - Dropbox path to list. Pass `""` for the root.
 * @param recursive - When true, recursively lists all subfolders.
 * @param onCursor - Called once with the final listing cursor after all pages load.
 */
export async function* streamFiles(
  token: string,
  nsId: string | null,
  path: string,
  recursive = false,
  onCursor?: (cursor: string) => void,
): AsyncGenerator<DbxEntry[]> {
  let data = await dbxPost<{ entries: DbxEntry[]; has_more: boolean; cursor: string }>(
    URL.listFolder, token, { path, recursive }, nsId,
  );
  if (!data.has_more) onCursor?.(data.cursor);
  yield data.entries;
  while (data.has_more) {
    data = await dbxPost(
      URL.listFolderMore, token, { cursor: data.cursor }, nsId,
    );
    if (!data.has_more) onCursor?.(data.cursor);
    yield data.entries;
  }
}

/**
 * Long-polls Dropbox for changes to the folder represented by `cursor`.
 * Blocks on the server for up to `timeout` seconds (max 480), returning
 * early as soon as a change is detected.
 *
 * Uses `notify.dropboxapi.com` — no Authorization header required.
 * When `backoff` is present in the response, callers should wait that
 * many seconds before the next poll to avoid rate-limiting.
 */
export async function pollForChanges(
  cursor: string,
  timeout = 30,
): Promise<{ changes: boolean; backoff?: number }> {
  const res = await fetch(URL.longpoll, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cursor, timeout }),
  });
  if (!res.ok) throw new Error(`Longpoll HTTP ${res.status}`);
  const data = await res.json() as { changes: boolean; backoff?: number };
  return { changes: Boolean(data.changes), backoff: data.backoff };
}

/**
 * Returns a short-lived direct download URL for a file.
 * Used to pass a fetchable URL to `kittl.design.image.addImage`.
 */
export async function getTemporaryLink(token: string, fileId: string): Promise<string> {
  const data = await dbxPost<{ link: string }>(
    URL.tempLink, token, { path: fileId },
  ).catch((err) => {
    console.error('[Dropbox] get_temporary_link failed:', err);
    throw new Error('Could not get file link. Please try again.');
  });
  return data.link;
}

/**
 * Uploads a `Blob` to the given Dropbox path.
 * Uses `autorename: true` so concurrent exports never collide.
 * Requires the `files.content.write` OAuth scope.
 *
 * @param path - Absolute Dropbox path, e.g. `/Kittl Exports/design-2026.png`.
 */
export async function uploadFile(token: string, path: string, blob: Blob): Promise<void> {
  const res = await fetch(URL.upload, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
    },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[Dropbox] upload failed:', res.status, text.slice(0, 200));
    throw new Error('Could not upload to Dropbox. Please try again.');
  }
}

/**
 * In-memory thumbnail cache keyed by stable Dropbox file ID.
 * Survives component remounts and silent refreshes for the lifetime of the tab.
 * Thumbnails for unchanged files are served instantly without a network round-trip.
 */
const thumbnailCache = new Map<string, string>();

/**
 * Fetches JPEG thumbnails for a batch of entries in groups of 25 (API limit).
 * Cached entries (by file ID) are returned immediately without hitting the API.
 * Unsupported file types are silently skipped by the Dropbox API.
 * Returns a map of `fileId → base64 data URI`.
 */
export async function getThumbnails(token: string, entries: DbxEntry[]): Promise<Record<string, string>> {
  const media = entries.filter((e) => e['.tag'] === 'file');
  if (!media.length) return {};

  const thumbs: Record<string, string> = {};
  const toFetch: DbxEntry[] = [];

  for (const entry of media) {
    const cached = thumbnailCache.get(entry.id);
    if (cached) { thumbs[entry.id] = cached; } else { toFetch.push(entry); }
  }

  for (let i = 0; i < toFetch.length; i += 25) {
    const batch = toFetch.slice(i, i + 25);
    const res = await fetch(URL.thumbnailBatch, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: batch.map((e) => ({ path: e.id, format: 'jpeg', size: 'w480h320', mode: 'fitone_bestfit' })),
      }),
    });
    const text = await res.text();
    if (!res.ok) { console.warn('[Dropbox] thumbnail batch error:', res.status, text.slice(0, 200)); continue; }
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch { continue; }
    for (const entry of (data.entries as Record<string, unknown>[]) ?? []) {
      if (entry['.tag'] === 'success') {
        const meta = entry.metadata as { id: string };
        const uri = `data:image/jpeg;base64,${entry.thumbnail as string}`;
        thumbnailCache.set(meta.id, uri);
        thumbs[meta.id] = uri;
      } else if (entry['.tag'] === 'failure') {
        console.warn('[Dropbox] thumbnail entry failed:', entry.failure);
      }
    }
  }
  return thumbs;
}
