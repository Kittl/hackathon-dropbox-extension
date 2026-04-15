import { kittl } from '@kittl/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DBX_PROVIDER, FILES_ONLY_KEY, PAGE_SIZE } from '../constants';
import type { DbxEntry } from '../lib/dropbox';
import { getHomeNamespaceId, getTemporaryLink, getThumbnails, streamFiles } from '../lib/dropbox';
import { canAddToCanvas } from '../lib/fileHelpers';

/**
 * Namespace resolution state:
 * - "pending" = not yet fetched
 * - string = resolved namespace ID (Business/Team accounts)
 * - null = personal account (no namespace header needed)
 */
type NsState = string | null | 'pending';

/**
 * Central hook for all Dropbox state, side effects, and actions.
 *
 * Responsibilities:
 * - Restoring the OAuth token from Kittl's cross-device auth storage on mount.
 * - Resolving the user's home namespace for Dropbox Business/Team accounts.
 * - Streaming file metadata page by page via an async generator.
 * - Load-on-scroll pagination (increases `displayCount` as the user scrolls).
 * - Lazy thumbnail fetching (only for items in the visible slice).
 * - Folder navigation with a path stack.
 * - Adding canvas-supported images to the Kittl design via `kittl.design.image.addImage`.
 */
export function useDropbox() {
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [nsId, setNsId] = useState<NsState>('pending');
  const [currentPath, setCurrentPath] = useState('');
  const [pathStack, setPathStack] = useState<{ path: string; name: string }[]>([]);
  const [files, setFiles] = useState<DbxEntry[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [filesOnlyMode, setFilesOnlyMode] = useState(() => localStorage.getItem(FILES_ONLY_KEY) === 'true');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Tracks which file IDs have already had thumbnail requests sent. */
  const fetchedThumbIds = useRef(new Set<string>());

  // Restore token from Kittl's cross-device storage on mount
  useEffect(() => {
    const check = async () => {
      const resp = await kittl.auth.getAuthToken({ provider: DBX_PROVIDER });
      if (resp.isOk && resp.result?.access_token) setToken(resp.result.access_token as string);
      setInitializing(false);
    };
    if (kittl.loaded) check();
    else kittl.onReady(check);
  }, []);

  /** Clears all Dropbox state and revokes the stored token via Kittl auth. */
  const disconnect = useCallback(() => {
    kittl.auth.logout({ provider: DBX_PROVIDER });
    localStorage.removeItem(FILES_ONLY_KEY);
    setToken(null);
    setNsId('pending');
    setCurrentPath('');
    setPathStack([]);
    setFiles([]);
    setThumbnails({});
    setDisplayCount(PAGE_SIZE);
    fetchedThumbIds.current = new Set();
    setFilesOnlyMode(false);
    setError(null);
  }, []);

  /**
   * Initiates the Dropbox OAuth PKCE flow via `kittl.auth`.
   * On success, stores the access token in state (which triggers file loading).
   */
  const connect = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const startResp = await kittl.auth.startAuth({ provider: DBX_PROVIDER, generatePKCE: true });
      if (!startResp.isOk) throw new Error('Auth failed.');
      const { code, code_verifier } = startResp.result;
      const exchangeResp = await kittl.auth.exchangeCode({ code, provider: DBX_PROVIDER, code_verifier });
      if (!exchangeResp.isOk) throw new Error('Token exchange failed.');
      setToken(exchangeResp.result?.access_token as string);
    } catch (err) {
      console.error('[Dropbox] connect failed:', err);
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Toggles "Hide folders" mode.
   * When enabled: navigates to root, lists all canvas-supported files recursively,
   * sorted by modification date. Persists the selection in localStorage.
   */
  const toggleFilesOnlyMode = useCallback(() => {
    setFilesOnlyMode((prev) => {
      const next = !prev;
      localStorage.setItem(FILES_ONLY_KEY, String(next));
      if (next) { setCurrentPath(''); setPathStack([]); }
      return next;
    });
  }, []);

  // Resolve Dropbox Business namespace so all API calls use the correct root
  useEffect(() => {
    if (!token) { setNsId('pending'); return; }
    getHomeNamespaceId(token).then(setNsId).catch(() => setNsId(null));
  }, [token]);

  // Stream file metadata — first page appears immediately, rest loads in background
  useEffect(() => {
    if (!token || nsId === 'pending') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFiles([]);
    setThumbnails({});
    setDisplayCount(PAGE_SIZE);
    fetchedThumbIds.current = new Set();

    (async () => {
      try {
        let firstPage = true;
        for await (const batch of streamFiles(token, nsId, filesOnlyMode ? '' : currentPath, filesOnlyMode)) {
          if (cancelled) return;
          setFiles((prev) => {
            const next = [...prev, ...(filesOnlyMode ? batch.filter(canAddToCanvas) : batch)];
            // In "Hide folders" mode, sort all files newest-first by modification date
            return filesOnlyMode
              ? next.sort((a, b) => +new Date(b.server_modified ?? 0) - +new Date(a.server_modified ?? 0))
              : next;
          });
          if (firstPage) { setLoading(false); firstPage = false; }
        }
        if (firstPage && !cancelled) setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === '401' || msg.includes('invalid_access_token') || msg.includes('expired')) {
          console.warn('[Dropbox] session expired, disconnecting');
          kittl.auth.logout({ provider: DBX_PROVIDER });
          setToken(null);
        } else {
          setError(msg);
        }
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, nsId, currentPath, filesOnlyMode]);

  // Load-on-scroll: increase displayCount when the user scrolls near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || displayCount >= files.length) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200)
        setDisplayCount((c) => Math.min(c + PAGE_SIZE, files.length));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [displayCount, files.length]);

  // Lazy thumbnails — only fetch for the currently visible slice to avoid large batch requests
  useEffect(() => {
    if (!token || !files.length) return;
    const toFetch = files.slice(0, displayCount).filter((f) => !fetchedThumbIds.current.has(f.id));
    if (!toFetch.length) return;
    toFetch.forEach((f) => fetchedThumbIds.current.add(f.id));
    getThumbnails(token, toFetch).then((thumbs) => {
      if (Object.keys(thumbs).length) setThumbnails((prev) => ({ ...prev, ...thumbs }));
    });
  }, [token, files, displayCount]);

  /** Navigates into a folder, pushing the current path onto the stack. */
  const openFolder = useCallback((f: DbxEntry) => {
    setPathStack((prev) => [...prev, { path: currentPath, name: f.name }]);
    setCurrentPath(f.path_lower);
  }, [currentPath]);

  /** Navigates back to the previous folder by popping the path stack. */
  const goBack = useCallback(() => {
    setPathStack((prev) => {
      const next = [...prev];
      setCurrentPath(next.pop()!.path);
      return next;
    });
  }, []);

  /**
   * Fetches a temporary download link for the file and adds it to the Kittl
   * canvas at the center of the viewport. Only canvas-supported images are
   * accepted; the button is disabled for all other file types.
   */
  const addToCanvas = useCallback(async (f: DbxEntry) => {
    if (!token || !canAddToCanvas(f) || adding) return;
    setAdding(f.id);
    setError(null);
    try {
      const link = await getTemporaryLink(token, f.id);
      const result = await kittl.design.image.addImage({
        src: link,
        position: { relative: { to: 'viewport', location: 'center' } },
        size: { width: 400, height: 300 },
      });
      if (!result.isOk) {
        console.error('[Kittl] addImage failed:', result.error);
        setError('Could not add image to canvas.');
      }
    } catch (err) {
      console.error('[Dropbox] addToCanvas failed:', err);
      setError('Could not add image to canvas.');
    } finally {
      setAdding(null);
    }
  }, [token, adding]);

  return {
    // Status
    initializing,
    loading,
    error,
    // Auth
    token,
    connect,
    disconnect,
    // Navigation — derived values computed here so App needs no logic
    title: filesOnlyMode ? 'All Files' : (pathStack[pathStack.length - 1]?.name ?? 'Dropbox Files'),
    showBack: !filesOnlyMode && pathStack.length > 0,
    goBack,
    // Files
    files,
    thumbnails,
    displayCount,
    filesOnlyMode,
    toggleFilesOnlyMode,
    openFolder,
    adding,
    addToCanvas,
    // Refs
    scrollRef,
  };
}
