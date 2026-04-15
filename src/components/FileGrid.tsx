import type { RefObject } from 'react';
import type { DbxEntry } from '../lib/dropbox';
import { FileCard } from './FileCard';

interface Props {
  files: DbxEntry[];
  /** Number of items to render — grows as the user scrolls (virtual pagination). */
  displayCount: number;
  /** Map of fileId → base64 thumbnail data URI. */
  thumbnails: Record<string, string>;
  /** ID of the file currently being added to the canvas, or null. */
  adding: string | null;
  filesOnlyMode: boolean;
  /** Ref attached to the scrollable container, used for scroll-based pagination. */
  scrollRef: RefObject<HTMLDivElement | null>;
  onOpenFolder: (f: DbxEntry) => void;
  onAddToCanvas: (f: DbxEntry) => void;
}

/**
 * Scrollable grid of `FileCard` items.
 * Renders only `displayCount` items at a time; the parent hook increases this
 * count as the user scrolls toward the bottom (load-on-scroll pagination).
 */
export function FileGrid({ files, displayCount, thumbnails, adding, filesOnlyMode, scrollRef, onOpenFolder, onAddToCanvas }: Props) {
  return (
    <div className="scroll-area" ref={scrollRef}>
      <div className="file-grid">
        {files.slice(0, displayCount).map((f) => (
          <FileCard
            key={f.id}
            file={f}
            thumbnail={thumbnails[f.id]}
            isAdding={adding === f.id}
            filesOnlyMode={filesOnlyMode}
            onOpenFolder={onOpenFolder}
            onAddToCanvas={onAddToCanvas}
          />
        ))}
      </div>
    </div>
  );
}
