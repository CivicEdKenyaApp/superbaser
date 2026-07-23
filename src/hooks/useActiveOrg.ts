import { useEffect, useState } from "react";
import { getActiveOrgId } from "@/lib/org-store";

export function useActiveOrg(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(getActiveOrgId());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string | null }>).detail;
      setId(detail?.id ?? null);
    };
    window.addEventListener("restore:org-changed", handler);
    return () => window.removeEventListener("restore:org-changed", handler);
  }, []);
  return id;
}
