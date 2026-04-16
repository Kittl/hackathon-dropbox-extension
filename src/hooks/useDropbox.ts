import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kittl } from '@kittl/sdk';
import { useToast } from '@kittl/ui-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DBX_PROVIDER, FILES_ONLY_KEY, PAGE_SIZE } from '../constants';
import type { DbxEntry, FilePage } from '../lib/dropbox';
import {
  fetchFilePage,
  getHomeNamespaceId,
  getTemporaryLink,
  getThumbnails,
  pollForChanges,
  uploadFile,
} from '../lib/dropbox';
import { canAddToCanvas } from '../lib/fileHelpers';

/**
 * Central hook for all Dropbox state, side effects, and actions.
 *
 * Server state (namespace, file listing) is managed by React Query.
 * Local UI state (path stack, thumbnails, display count) stays in useState/useRef.
 * The longpoll loop calls `queryClient.invalidateQueries` to trigger silent background
 * refreshes when Dropbox detects remote changes.
 */
export function useDropbox() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // ── Local UI state ────────────────────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [pathStack, setPathStack] = useState<{ path: string; name: string }[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [filesOnlyMode, setFilesOnlyMode] = useState(
    () => localStorage.getItem(FILES_ONLY_KEY) === 'true',
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchedThumbIds = useRef(new Set<string>());
  /** Final listing cursor — updated once all pages load, used by the longpoll loop. */
  const cursorRef = useRef<string | null>(null);

  // ── Token restoration ─────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const resp = await kittl.auth.getAuthToken({ provider: DBX_PROVIDER });
      if (resp.isOk && resp.result?.access_token) setToken(resp.result.access_token as string);
      setInitializing(false);
    };
    if (kittl.loaded) check(); else kittl.onReady(check);
  }, []);

  // ── Namespace (React Query) ───────────────────────────────────────────────────
  const nsQuery = useQuery({
    queryKey: ['dbx-namespace', token],
    queryFn: () => getHomeNamespaceId(token!),
    enabled: !!token,
    staleTime: Infinity,
    retry: false,
  });
  // 'pending' while namespace is resolving; null for personal accounts; string for Business
  const nsId = !token ? 'pending' : nsQuery.isLoading ? 'pending' : (nsQuery.data ?? null);

  // ── File listing (React Query — cursor-based infinite pagination) ─────────────
  const filesQuery = useInfiniteQuery({
    queryKey: ['dbx-files', token, nsId, currentPath, filesOnlyMode],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchFilePage(token!, nsId as string | null, filesOnlyMode ? '' : currentPath, filesOnlyMode, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: FilePage) => page.has_more ? page.cursor : undefined,
    enabled: !!token && nsId !== 'pending',
    staleTime: Infinity,
    retry: false,
  });

  // Auto-fetch remaining pages as they become available (streaming feel)
  useEffect(() => {
    if (filesQuery.hasNextPage && !filesQuery.isFetchingNextPage) filesQuery.fetchNextPage();
  }, [filesQuery.hasNextPage, filesQuery.isFetchingNextPage, filesQuery.fetchNextPage]);

  // Flatten all pages into a sorted, filtered files array
  const files = useMemo(() => {
    const entries = filesQuery.data?.pages.flatMap((p) => p.entries) ?? [];
    const filtered = filesOnlyMode ? entries.filter(canAddToCanvas) : entries;
    return filesOnlyMode
      ? [...filtered].sort((a, b) => +new Date(b.server_modified ?? 0) - +new Date(a.server_modified ?? 0))
      : filtered;
  }, [filesQuery.data, filesOnlyMode]);

  // ── Context-change resets ─────────────────────────────────────────────────────
  // Clear thumbnail state and reset pagination when the viewed context changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    fetchedThumbIds.current = new Set();
    setThumbnails({});
  }, [currentPath, filesOnlyMode, token]);

  // Reset cursor when context changes so the longpoll waits for the new final cursor
  useEffect(() => { cursorRef.current = null; }, [currentPath, filesOnlyMode]);

  // Capture the final cursor once all pages are loaded (needed for longpoll)
  useEffect(() => {
    if (!filesQuery.hasNextPage && filesQuery.data?.pages.length) {
      cursorRef.current = filesQuery.data.pages.at(-1)!.cursor;
    }
  }, [filesQuery.hasNextPage, filesQuery.data?.pages]);

  // ── 401 / session-expiry handling ─────────────────────────────────────────────
  useEffect(() => {
    const err = filesQuery.error;
    if (!err) return;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === '401' || msg.includes('invalid_access_token') || msg.includes('expired')) {
      console.warn('[Dropbox] session expired, disconnecting');
      kittl.auth.logout({ provider: DBX_PROVIDER });
      setToken(null);
      queryClient.clear();
    }
  }, [filesQuery.error, queryClient]);

  // ── Longpoll loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const loop = async () => {
      while (!cancelled) {
        const cursor = cursorRef.current;
        if (!cursor) { await sleep(1000); continue; }
        try {
          const { changes, backoff } = await pollForChanges(cursor);
          if (cancelled) return;
          if (backoff) await sleep(backoff * 1000);
          if (changes) {
            console.log('[Dropbox] longpoll: changes detected, refreshing');
            queryClient.invalidateQueries({ queryKey: ['dbx-files'] });
            await sleep(3000);
          }
        } catch (err) {
          if (cancelled) return;
          console.warn('[Dropbox] longpoll error, retrying in 15s:', err);
          await sleep(15000);
        }
      }
    };

    loop();
    return () => { cancelled = true; };
  }, [token, queryClient]);

  // ── Load-on-scroll ────────────────────────────────────────────────────────────
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

  // ── Lazy thumbnails ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !files.length) return;
    const toFetch = files.slice(0, displayCount).filter((f) => !fetchedThumbIds.current.has(f.id));
    if (!toFetch.length) return;
    toFetch.forEach((f) => fetchedThumbIds.current.add(f.id));
    getThumbnails(token, toFetch).then((thumbs) => {
      if (Object.keys(thumbs).length) setThumbnails((prev) => ({ ...prev, ...thumbs }));
    });
  }, [token, files, displayCount]);

  // ── Canvas selection polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setSelectedIds([]); return; }
    const tick = async () => {
      const res = await kittl.state.getSelectedObjectsIds();
      if (!res.isOk) return;
      setSelectedIds((prev) => {
        const next = res.result;
        if (prev.length === next.length && prev.every((id, i) => id === next[i])) return prev;
        return next;
      });
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [token]);

  // ── Auth mutations ────────────────────────────────────────────────────────────
  const connectMutation = useMutation({
    mutationFn: async () => {
      const startResp = await kittl.auth.startAuth({ provider: DBX_PROVIDER, generatePKCE: true });
      if (!startResp.isOk) throw new Error('Auth failed.');
      const { code, code_verifier } = startResp.result;
      const exchangeResp = await kittl.auth.exchangeCode({ code, provider: DBX_PROVIDER, code_verifier });
      if (!exchangeResp.isOk) throw new Error('Token exchange failed.');
      return exchangeResp.result?.access_token as string;
    },
    onSuccess: (accessToken) => setToken(accessToken),
    onError: (err) => console.error('[Dropbox] connect failed:', err),
  });

  const disconnect = useCallback(() => {
    kittl.auth.logout({ provider: DBX_PROVIDER });
    localStorage.removeItem(FILES_ONLY_KEY);
    queryClient.clear();
    cursorRef.current = null;
    setToken(null);
    setCurrentPath('');
    setPathStack([]);
    setFilesOnlyMode(false);
  }, [queryClient]);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const toggleFilesOnlyMode = useCallback(() => {
    setFilesOnlyMode((prev) => {
      const next = !prev;
      localStorage.setItem(FILES_ONLY_KEY, String(next));
      if (next) { setCurrentPath(''); setPathStack([]); }
      return next;
    });
  }, []);

  const openFolder = useCallback((f: DbxEntry) => {
    setPathStack((prev) => [...prev, { path: currentPath, name: f.name }]);
    setCurrentPath(f.path_lower);
  }, [currentPath]);

  const goBack = useCallback(() => {
    setPathStack((prev) => {
      const next = [...prev];
      setCurrentPath(next.pop()!.path);
      return next;
    });
  }, []);

  // ── File / canvas mutations ───────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async (f: DbxEntry) => {
      const link = await getTemporaryLink(token!, f.id);
      const result = await kittl.design.image.addImage({
        src: link,
        position: { relative: { to: 'viewport', location: 'center' } },
        size: { width: 400, height: 300 },
      });
      if (!result.isOk) throw new Error('Could not add image to canvas.');
    },
    onError: (err) => console.error('[Dropbox] addToCanvas failed:', err),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const exportRes = await kittl.design.canvas.getExport({
        format: 'png',
        target: { nodeIds: selectedIds },
        dimensions: { multiplier: 2 },
      });
      if (!exportRes.isOk) throw new Error('Export failed.');
      if (!exportRes.result) throw new Error('Export returned empty result.');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      await uploadFile(token!, `/Kittl Exports/export-${timestamp}.png`, exportRes.result);
    },
    onSuccess: () => {
      showToast('Exported to Dropbox!', 'success');
      // Invalidate file list so the exported file appears — React Query does a silent background refresh
      queryClient.invalidateQueries({ queryKey: ['dbx-files'] });
    },
    onError: (err) => {
      console.error('[Export] exportToDropbox failed:', err);
      showToast('Could not export to Dropbox.', 'error');
    },
  });

  // ── Derived state ─────────────────────────────────────────────────────────────
  // isLoading = isPending && isFetching — true only on genuine first fetch, not background refetches
  const loading = connectMutation.isPending || (!!token && (nsQuery.isLoading || filesQuery.isLoading));
  const error = filesQuery.error instanceof Error ? filesQuery.error.message
    : connectMutation.isError ? 'Connection failed. Please try again.'
    : null;

  return {
    // Status
    initializing,
    loading,
    error,
    // Auth
    token,
    connect: () => connectMutation.mutate(),
    disconnect,
    // Navigation
    title: filesOnlyMode ? 'All Files' : (pathStack[pathStack.length - 1]?.name ?? 'Files'),
    showBack: !filesOnlyMode && pathStack.length > 0,
    goBack,
    // Files
    files,
    thumbnails,
    displayCount,
    filesOnlyMode,
    toggleFilesOnlyMode,
    openFolder,
    adding: addMutation.isPending ? (addMutation.variables as DbxEntry | undefined)?.id ?? null : null,
    addToCanvas: (f: DbxEntry) => { if (!addMutation.isPending) addMutation.mutate(f); },
    // Export
    selectedIds,
    exporting: exportMutation.isPending,
    exportToDropbox: exportMutation.mutate,
    // Refs
    scrollRef,
  };
}
