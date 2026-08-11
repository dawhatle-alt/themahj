import { useEffect, useState } from "react";
import { listCategories, type ApiCategory } from "./api";

// Three separate pages render category chips, and the admin panel needs the
// same list. A module-level cache keeps that to one request per page load
// without threading the list through App as a prop.
let cache: ApiCategory[] | null = null;
let inflight: Promise<ApiCategory[]> | null = null;
const subscribers = new Set<(c: ApiCategory[]) => void>();

function load(): Promise<ApiCategory[]> {
  if (!inflight) {
    inflight = listCategories()
      .then((categories) => {
        cache = categories;
        subscribers.forEach((fn) => fn(categories));
        return categories;
      })
      .catch(() => {
        // An empty list degrades to gold chips rather than breaking the page.
        inflight = null;
        return [];
      });
  }
  return inflight;
}

/** Clears the cache so the next read refetches — call after an admin edit. */
export function invalidateCategories(): void {
  cache = null;
  inflight = null;
  void load();
}

export function useCategories(): ApiCategory[] {
  const [categories, setCategories] = useState<ApiCategory[]>(cache ?? []);

  useEffect(() => {
    subscribers.add(setCategories);
    if (cache) setCategories(cache);
    else void load().then(setCategories);
    return () => {
      subscribers.delete(setCategories);
    };
  }, []);

  return categories;
}
