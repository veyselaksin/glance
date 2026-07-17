import { useState, useEffect } from 'react';
import type { AppData } from '../types';
import { getLastData } from '../services/app.service';
import { onDataUpdated } from '../lib/events';

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    const poll = async () => {
      const d = await getLastData();
      if (d?.updated_at) setData(d);
    };
    poll();
    const pollId = setInterval(poll, 5_000);

    const off = onDataUpdated((d) => {
      if (d?.updated_at) setData(d);
    });

    return () => {
      clearInterval(pollId);
      off();
    };
  }, []);

  return data;
}
