import { Button, Text } from '@kittl/ui-react';

interface Props {
  loading: boolean;
  onConnect: () => void;
}

/**
 * Full-height centered panel shown before the user connects their Dropbox account.
 * Shows the Dropbox mark, an invitation message, and the connect button.
 */
export function ConnectPanel({ loading, onConnect }: Props) {
  return (
    <div className="connect-panel">
      <img className="empty-state-icon" src="/icon-dropbox-mark.svg" alt="" aria-hidden />
      <Text variant="p2" color="secondary" style={{ textAlign: 'center' }}>Get started by connecting your account.</Text>
      <Button variant="primary" size="m" onClick={onConnect} disabled={loading}>
        {loading ? 'Connecting…' : 'Connect Dropbox'}
      </Button>
    </div>
  );
}
