import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Tiny data-fetch hook. `fn` should return a promise.
 * Re-runs when any of the `deps` change.
 */
export default function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fnRef.current();
      setData(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refresh: run };
}
