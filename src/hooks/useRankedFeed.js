// hooks/useRankedFeed.js
import { useEffect, useState, useCallback } from "react";
import { rankSubjects } from "@/api/feedRanker";

export function useRankedFeed(subjects = [], options = {}) {
  const [loading, setLoading] = useState(true);
  const [ranked, setRanked] = useState([]);
  const [meta, setMeta] = useState(null);

  const run = useCallback(async () => {
    if (!subjects.length) {
      setRanked([]);
      setMeta(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { items, meta } = await rankSubjects(subjects, options);
      setRanked(items);
      setMeta(meta);
    } catch (e) {
      console.error("useRankedFeed error:", e);
      setRanked([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(subjects), JSON.stringify(options)]);

  useEffect(() => {
    run();
  }, [run]);

  return { ranked, meta, loading, refresh: run };
}
