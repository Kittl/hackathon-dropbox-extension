import { Text } from '@kittl/ui-react';

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
      <img className="empty-state-icon" src="/icon-dropbox-mark.svg" alt="" aria-hidden />
      <Text variant="p2" color="secondary">{message}</Text>
    </div>
  );
}
