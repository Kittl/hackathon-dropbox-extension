import { Text } from '@kittl/ui-react';
import dropboxMark from '../assets/icon-dropbox-mark.svg';

interface Props {
  /** Message shown below the icon. */
  message?: string;
}

/**
 * Centered empty-state panel with a muted Dropbox mark and a short message.
 * Used when a folder has no files or no results match the current mode.
 */
export function EmptyState({ message = 'No files found.' }: Props) {
  return (
    <div className="empty-state">
      <img className="empty-state-icon" src={dropboxMark} alt="" aria-hidden />
      <Text variant="p2" color="secondary">{message}</Text>
    </div>
  );
}
