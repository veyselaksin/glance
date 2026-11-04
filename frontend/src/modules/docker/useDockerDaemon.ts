import { useCallback, useEffect, useState } from 'react';
import { getDockerRuntime, startDockerDaemon } from '../../services/docker.service';

/** Detects the local Docker runtime and starts it on demand. */
export function useDockerDaemon(onStarted: () => void) {
  const [runtime, setRuntime] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDockerRuntime().then(setRuntime).catch(() => setRuntime(''));
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      await startDockerDaemon();
      onStarted();
    } catch (e) {
      setError(String(e));
    } finally {
      setStarting(false);
    }
  }, [onStarted]);

  return { runtime, starting, error, start };
}
