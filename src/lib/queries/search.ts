import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 150;

export function useDebounced<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useSearch(query: string, enabled = true) {
  const debounced = useDebounced(query.trim());
  const ready = enabled && debounced.length >= MIN_QUERY_LEN;
  return useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced, 30),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
