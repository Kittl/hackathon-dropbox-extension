import { kittl } from '@kittl/sdk';
import { Button, Text } from '@kittl/ui-react';
import { useCallback, useState } from 'react';

export function App() {
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const addText = useCallback(async () => {
    setBusy(true);
    setLastError(null);
    try {
      const result = await kittl.design.text.addText({
        text: 'Hello test-ext-blesson from Kittl SDK!',
        position: {
          relative: {
            to: 'viewport',
            location: 'center',
          },
        },
        size: {
          height: 100,
          width: 400,
        },
      });
      if (!result.isOk) {
        setLastError(result.error?.message ?? 'SDK call failed');
      }
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Text variant="h4" color="default">
        Hello Kittl
      </Text>
      <Text variant="p2" color="secondary">
        Welcome to your extension: test-ext-blesson
      </Text>
      <div>
        <Button variant="primary" size="m" type="button" disabled={busy} onClick={addText}>
          Do some magic!
        </Button>
      </div>
      {lastError ? (
        <Text variant="p3" color="critical">
          {lastError}
        </Text>
      ) : null}
    </div>
  );
}
