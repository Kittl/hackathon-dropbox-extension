import { Spinner, Text } from '@kittl/ui-react';

import { ConnectPanel } from './components/ConnectPanel';
import { EmptyState } from './components/EmptyState';
import { FileGrid } from './components/FileGrid';
import { Header } from './components/Header';
import { useDropbox } from './hooks/useDropbox';
import './styles.css';

/**
 * Root component. Thin composition layer — all state and logic lives in
 * `useDropbox`. Renders the appropriate panel based on auth/loading state.
 */
export function App() {
  const dbx = useDropbox();

  if (dbx.initializing) return <div className="center"><Spinner /></div>;

  return (
    <div className="app">
      <Header
        title={dbx.title}
        showBack={dbx.showBack}
        showMenu={!!dbx.token}
        filesOnlyMode={dbx.filesOnlyMode}
        onBack={dbx.goBack}
        onToggleFilesOnly={dbx.toggleFilesOnlyMode}
        onDisconnect={dbx.disconnect}
      />

      {!dbx.token ? (
        <ConnectPanel loading={dbx.loading} onConnect={dbx.connect} />
      ) : dbx.loading ? (
        <div className="center"><Spinner /></div>
      ) : dbx.files.length === 0 ? (
        <EmptyState />
      ) : (
        <FileGrid
          files={dbx.files}
          displayCount={dbx.displayCount}
          thumbnails={dbx.thumbnails}
          adding={dbx.adding}
          filesOnlyMode={dbx.filesOnlyMode}
          scrollRef={dbx.scrollRef}
          onOpenFolder={dbx.openFolder}
          onAddToCanvas={dbx.addToCanvas}
        />
      )}

      {dbx.error && <Text variant="p3" color="critical">{dbx.error}</Text>}
    </div>
  );
}
