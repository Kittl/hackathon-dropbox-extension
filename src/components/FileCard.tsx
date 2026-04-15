import { documentCopy, folder, video } from '@kittl/ui-icons';
import { Card, Icon, Spinner } from '@kittl/ui-react';
import type { DbxEntry } from '../lib/dropbox';
import { canAddToCanvas, isVideo } from '../lib/fileHelpers';

interface Props {
  file: DbxEntry;
  /** Base64 data URI thumbnail, if available. */
  thumbnail?: string;
  /** Whether this file is currently being added to the canvas. */
  isAdding: boolean;
  /** When true, folder cards are non-interactive (used in "Hide folders" mode). */
  filesOnlyMode: boolean;
  onOpenFolder: (f: DbxEntry) => void;
  onAddToCanvas: (f: DbxEntry) => void;
}

/**
 * Grid card representing a single Dropbox file or folder.
 *
 * - Folders: clickable to navigate into them (unless in "Hide folders" mode).
 * - Canvas-supported images: clickable to add to the Kittl canvas.
 * - Other file types: rendered as disabled/greyed-out.
 * - Shows a thumbnail when available, otherwise falls back to a type icon.
 * - Overlays a spinner while the file is being added to the canvas.
 * - Shows the full file/folder name as a native tooltip when hovering the title.
 */
export function FileCard({ file: f, thumbnail, isAdding, filesOnlyMode, onOpenFolder, onAddToCanvas }: Props) {
  const isFolder = f['.tag'] === 'folder';
  const addable = canAddToCanvas(f);
  const interactive = isFolder || addable;

  const handleClick = isFolder && !filesOnlyMode
    ? () => onOpenFolder(f)
    : addable ? () => onAddToCanvas(f)
    : undefined;

  return (
    <div className={`file-card-wrap${!interactive ? ' file-card-wrap--disabled' : ''}`}>
      <Card bordered interactive={interactive} disabled={!interactive} onCardClick={handleClick}>
        {thumbnail ? (
          <img slot="media" src={thumbnail} alt={f.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div slot="media" className="file-card-media-icon">
            <div className="file-card-media-icon-inner">
              <Icon icon={isFolder ? folder : isVideo(f.name) ? video : documentCopy} />
            </div>
          </div>
        )}
        <span className="file-card-name" title={f.name}>{f.name}</span>
      </Card>

      {isAdding && (
        <div className="file-card-overlay">
          <Spinner />
        </div>
      )}
    </div>
  );
}
