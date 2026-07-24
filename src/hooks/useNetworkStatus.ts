import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OfflineManifest {
    title: string;
    items: string[];
    cachedAt: string;
}

export const OFFLINE_CACHE_KEY = "aflewo_offline_manifests";
export const MAX_CACHED_MANIFESTS = 10;

// ─── Bandwidth Detection ──────────────────────────────────────────────────────
// Uses the Network Information API where available, with RTT/downlink heuristics.
// Falls back to navigator.onLine for older browsers.
export function useBandwidth() {
    const [isLowBandwidth, setIsLowBandwidth] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const checkBandwidth = () => {
            if (typeof window === "undefined") return;

            // navigator.onLine is a very basic check
            setIsOnline(navigator.onLine);

            // Network Information API (Chrome/Android support)
            const nav = navigator as Navigator & {
                connection?: {
                    effectiveType?: string;
                    downlink?: number;
                    rtt?: number;
                    saveData?: boolean;
                };
            };

            const conn = nav.connection;
            if (conn) {
                // effectiveType: "2g" | "3g" | "4g" | "slow-2g"
                const isSlowConnection =
                    conn.effectiveType === "2g" ||
                    conn.effectiveType === "slow-2g" ||
                    (conn.downlink !== undefined && conn.downlink < 1.0) || // <1 Mbps
                    (conn.rtt !== undefined && conn.rtt > 500) ||           // >500ms RTT
                    conn.saveData === true;                                  // Data Saver mode

                setIsLowBandwidth(isSlowConnection);
            } else {
                // Fallback: if navigator.onLine is true, assume reasonable bandwidth
                setIsLowBandwidth(!navigator.onLine);
            }
        };

        checkBandwidth();

        window.addEventListener("online", checkBandwidth);
        window.addEventListener("offline", checkBandwidth);

        // Also listen to connection changes if API is available
        const nav = navigator as Navigator & {
            connection?: EventTarget & { addEventListener: (event: string, cb: () => void) => void };
        };
        nav.connection?.addEventListener("change", checkBandwidth);

        return () => {
            window.removeEventListener("online", checkBandwidth);
            window.removeEventListener("offline", checkBandwidth);
        };
    }, []);

    return { isLowBandwidth, isOnline };
}

// ─── Offline Manifest Store ───────────────────────────────────────────────────
// Persists logistical AI responses to localStorage for offline access.
export function useOfflineManifest() {
    const [manifests, setManifests] = useState<OfflineManifest[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = localStorage.getItem(OFFLINE_CACHE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as OfflineManifest[];
                setManifests(parsed);
            }
        } catch {
            // Corrupt data — reset silently
            localStorage.removeItem(OFFLINE_CACHE_KEY);
        }
    }, []);

    // Save a new manifest returned from the AI backend
    const saveManifest = useCallback((manifest: OfflineManifest) => {
        setManifests(prev => {
            // Avoid duplicates by title
            const deduped = prev.filter(m => m.title !== manifest.title);
            // Keep only the most recent N manifests to not bloat localStorage
            const updated = [manifest, ...deduped].slice(0, MAX_CACHED_MANIFESTS);

            try {
                localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(updated));
            } catch {
                // Storage full — skip silently
            }

            return updated;
        });
    }, []);

    // Clear all cached manifests
    const clearManifests = useCallback(() => {
        localStorage.removeItem(OFFLINE_CACHE_KEY);
        setManifests([]);
    }, []);

    return { manifests, saveManifest, clearManifests };
}
