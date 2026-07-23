const KEY = "restore.activeOrganizationId";

export function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActiveOrgId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("restore:org-changed", { detail: { id } }));
  } catch {
    /* ignore */
  }
}
