import { Button, Spinner } from '@kittl/ui-react';
import dropboxMark from '../assets/icon-dropbox-mark.svg';

interface Props {
  /** Whether an export+upload is currently in progress. */
  exporting: boolean;
  onExport: () => void;
}

/**
 * Sticky footer shown when the user has one or more canvas objects selected.
 * Exports the selection as PNG and uploads it to `/Kittl Exports/` in Dropbox.
 */
export function ExportFooter({ exporting, onExport }: Props) {
  return (
    <div className="export-footer">
      <Button variant="primary" size="m" onClick={onExport} disabled={exporting}>
        {exporting ? (
          <Spinner />
        ) : (
          <img className="export-footer-icon" src={dropboxMark} alt="" aria-hidden />
        )}
        {exporting ? 'Exporting…' : 'Export Selected'}
      </Button>
    </div>
  );
}
