import { useEffect, useState } from "react";

/** Returns true only after the client has hydrated. Safe for browser-only UI. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
