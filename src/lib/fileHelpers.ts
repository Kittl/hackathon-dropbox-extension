import type { DbxEntry } from './dropbox';

/** Common video extensions — used only to pick the video icon in the UI. */
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v']);

/** Web-renderable image formats supported by the Kittl canvas. */
const CANVAS_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);

/** Extracts the lowercase file extension from a filename. */
const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** Returns true if the filename has a common video extension. */
export const isVideo = (name: string) => VIDEO_EXTS.has(ext(name));

/** Returns true if the entry is a file with a canvas-supported image format. */
export const canAddToCanvas = (e: DbxEntry) => e['.tag'] === 'file' && CANVAS_EXTS.has(ext(e.name));
