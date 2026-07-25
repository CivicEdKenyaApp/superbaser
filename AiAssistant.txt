"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { motion, AnimatePresence } from "framer-motion";
import SvgIcon from "@/components/ui/SvgIcon";
import fireMicData from "@/../context/lottie/Fire Mic Animation - LIstening_AI.json";
import aiChatData from "@/../context/inspo/AI Chat.json";
import { useAuth } from "@/app/(dashboard)/AuthContext";
import { useBandwidth, useOfflineManifest } from "@/hooks/useNetworkStatus";
import { events } from "@/lib/events";

// ─── Wallpaper Presets ────────────────────────────────────────────────────────
const WALLPAPER_PRESETS = [
    { id: "default", label: "Default", value: null, preview: "hsl(20 14% 5%)" },
    { id: "cosmos", label: "Cosmos", value: "linear-gradient(160deg,#0f0c29,#302b63,#24243e)", preview: "#302b63" },
    { id: "gold", label: "Gold Dust", value: "linear-gradient(160deg,#1a0e00,#3d2500,#1a0e00)", preview: "#3d2500" },
    { id: "forest", label: "Forest", value: "linear-gradient(160deg,#0a1a0f,#0d2f18,#071208)", preview: "#0d2f18" },
    { id: "nebula", label: "Nebula", value: "linear-gradient(160deg,#1a0020,#2d0035,#0d0015)", preview: "#2d0035" },
    { id: "ocean", label: "Ocean", value: "linear-gradient(160deg,#000d1a,#00243d,#000d1a)", preview: "#00243d" },
];
const WP_STORAGE_KEY = "aflewo_chat_wallpaper";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
}

interface NavigationAction {
    type: "navigate_to" | "scroll_to";
    target: string;
}

// --- Island State Machine Types ---
// Valid states: IDLE | CHAT_ACTIVE | MAP_VIEW | OFFLINE_TICKET | LIVE_WAVEFORM
// Only one state active at a time. Transitions are atomic.
type IslandMode = "IDLE" | "CHAT_ACTIVE" | "MAP_VIEW" | "OFFLINE_TICKET" | "LIVE_WAVEFORM";

interface IslandPayload {
    lat?: number;
    lng?: number;
    label?: string;
    items?: string[];
}

interface IslandState {
    mode: IslandMode;
    payload: IslandPayload | null;
}

//     Web Speech API declarations                                               ¬
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

// ─── Send icon SVG ────────────────────────────────────────────────────────────
function SendIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.1391 2.95907L7.10914 5.95907C1.03914 7.98907 1.03914 11.2991 7.10914 13.3191L9.78914 14.2091L10.6791 16.8891C12.6991 22.9591 16.0191 22.9591 18.0391 16.8891L21.0491 7.86907C22.3891 3.81907 20.1891 1.60907 16.1391 2.95907ZM16.4591 8.33907L12.6591 12.1591C12.5091 12.3091 12.3191 12.3791 12.1291 12.3791C11.9391 12.3791 11.7491 12.3091 11.5991 12.1591C11.3091 11.8691 11.3091 11.3891 11.5991 11.0991L15.3991 7.27907C15.6891 6.98907 16.1691 6.98907 16.4591 7.27907C16.7491 7.56907 16.7491 8.04907 16.4591 8.33907Z" fill="currentColor" />
        </svg>
    );
}

//     Close icon SVG                                                            ¬
function CloseIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

//     Mic icon SVG                                                              ¬
function MicIcon({ active }: { active: boolean }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12,20a9,9,0,0,1-7-3.37,1,1,0,0,1,1.56-1.26,7,7,0,0,0,10.92,0A1,1,0,0,1,19,16.63,9,9,0,0,1,12,20Z" fill={active ? "hsl(42 92% 56%)" : "currentColor"} />
            <path d="M12,2A5,5,0,0,0,7,7v4a5,5,0,0,0,10,0V7A5,5,0,0,0,12,2Z" fill={active ? "hsl(42 92% 56%)" : "currentColor"} />
            <path d="M12,22a1,1,0,0,1-1-1V19a1,1,0,0,1,2,0v2A1,1,0,0,1,12,22Z" fill={active ? "hsl(42 92% 56%)" : "currentColor"} />
        </svg>
    );
}

// ─── Hyperlink & Context Parser ──────────────────────────────────────────────
const PAGE_DICTIONARY: Record<string, string> = {
    "media page": "/media",
    "media": "/media",
    "about page": "/about",
    "about": "/about",
    "testimonies page": "/testify",
    "testify page": "/testify",
    "testify": "/testify",
    "join page": "/join",
    "join": "/join",
    "stories page": "/stories",
    "stories": "/stories",
    "alumni page": "/alumni",
    "alumni": "/alumni",
    "chapters page": "/chapters",
    "chapters": "/chapters",
    "nairobi chapter": "/chapters/nairobi",
    "mombasa chapter": "/chapters/mombasa",
    "nakuru chapter": "/chapters/nakuru",
    "rwanda chapter": "/chapters/rwanda",
    "tanzania chapter": "/chapters/tanzania",
    "nyeri chapter": "/chapters/nyeri",
    "meru chapter": "/chapters/meru",
    "eldoret chapter": "/chapters/eldoret",
    "kigali chapter": "/chapters/rwanda",
    "dar es salaam chapter": "/chapters/tanzania",
    "events page": "/events",
    "events": "/events",
    "sign in page": "/auth",
    "profile page": "/profile",
    "home page": "/",
    "home": "/"
};
const FUZZY_LINK_KEYS = Object.keys(PAGE_DICTIONARY).filter(key => key.includes(" "));
const fuzzyRegex = new RegExp(`\\b(${FUZZY_LINK_KEYS.join("|")})\\b`, "gi");

// ─── CopyableToken ────────────────────────────────────────────────────────────
function CopyableToken({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button
            onClick={handleCopy}
            title={`Tap to copy: ${value}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gold/15 border border-gold/30 text-gold font-black text-[11px] cursor-pointer hover:bg-gold/25 active:scale-95 transition-all select-all mx-0.5"
        >
            <span>{label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 shrink-0">
                {copied
                    ? <><polyline points="20 6 9 17 4 12" /></>
                    : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>}
            </svg>
        </button>
    );
}

function applyFuzzyLinks(text: string, baseIndex: number, onNavigate?: (url?: string) => void, isUser?: boolean) {
    const parts = text.split(fuzzyRegex);
    return parts.map((part, i) => {
        const lowerPart = part.toLowerCase();
        const url = PAGE_DICTIONARY[lowerPart];
        if (url) {
            return (
                <Link
                    key={`fuzzy-${baseIndex}-${i}`}
                    href={url}
                    onClick={() => {
                        if (onNavigate) onNavigate(url);
                    }}
                    className={`underline hover:opacity-80 font-bold transition-all ${!isUser && "text-gold"}`}
                >
                    {part}
                </Link>
            );
        }
        return part;
    });
}

function parseMessageContent(content: string, profile: any, onNavigate?: (url?: string) => void, isUser?: boolean) {
    let replacedText = content;
    if (profile) {
        replacedText = replacedText
            .replace(/\[USER_ID\]/g, profile.id || "")
            .replace(/\[USER_UUID\]/g, profile.id || "")
            .replace(/\[USER_NAME\]/g, profile.full_name || "")
            .replace(/\[USER_EMAIL\]/g, profile.email || "")
            .replace(/\[USER_ROLE\]/g, profile.role || "");
    } else {
        replacedText = replacedText
            .replace(/\[USER_ID\]/g, "")
            .replace(/\[USER_UUID\]/g, "")
            .replace(/\[USER_NAME\]/g, "Guest")
            .replace(/\[USER_EMAIL\]/g, "")
            .replace(/\[USER_ROLE\]/g, "");
    }

    const parts: any[] = [];
    let lastIndex = 0;
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    let matchCount = 0;

    while ((match = regex.exec(replacedText)) !== null) {
        const textBefore = replacedText.substring(lastIndex, match.index);
        if (textBefore) {
            parts.push(...applyFuzzyLinks(textBefore, matchCount++, onNavigate, isUser));
        }

        const linkText = match[1];
        const linkUrl = match[2];
        const isInternal = !linkUrl.startsWith("http") && !linkUrl.startsWith("//");
        const isCopyAction = linkUrl.startsWith("#copy:");

        if (isCopyAction) {
            const textToCopy = linkUrl.replace("#copy:", "");
            parts.push(
                <CopyableToken key={match.index} value={textToCopy} label={linkText} />
            );
        } else if (isInternal) {
            parts.push(
                <Link
                    key={match.index}
                    href={linkUrl}
                    onClick={() => {
                        if (onNavigate) onNavigate(linkUrl);
                    }}
                    className={`underline hover:opacity-80 font-bold transition-all ${!isUser && "text-gold"}`}
                >
                    {linkText}
                </Link>
            );
        } else {
            parts.push(
                <a
                    key={match.index}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline hover:opacity-80 font-bold transition-all ${!isUser && "text-gold"}`}
                >
                    {linkText}
                </a>
            );
        }

        lastIndex = regex.lastIndex;
    }

    const textAfter = replacedText.substring(lastIndex);
    if (textAfter) {
        parts.push(...applyFuzzyLinks(textAfter, matchCount++, onNavigate, isUser));
    }

    return parts.length > 0 ? parts : applyFuzzyLinks(replacedText, matchCount, onNavigate, isUser);
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────
function ChatBubble({ msg, onNavigate }: { msg: Message; onNavigate?: (url?: string) => void }) {
    const { profile } = useAuth();
    const isUser = msg.role === "user";
    return (
        <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
        >
            <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isUser
                    ? "bg-gold/90 text-brown font-semibold rounded-br-sm"
                    : "bg-white/8 text-white/90 border border-white/10 rounded-bl-sm"
                    }`}
                style={{ backdropFilter: isUser ? undefined : "blur(8px)" }}
            >
                {parseMessageContent(msg.content, profile, onNavigate, isUser)}
            </div>
        </motion.div>
    );
}

// ─── Dynamic Suggestions Carousel ─────────────────────────────────────────────
function DynamicSuggestions({ suggestions, onSelect }: { suggestions: any[], onSelect: (prompt: string) => void }) {
    const [currentIndex, setCurrentIndex] = useState(1);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (suggestions.length <= 3 || isHovered) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => {
                let next = prev + 1;
                if (next >= suggestions.length) next = 1;
                return next;
            });
        }, 8000); // Rotate every 8 seconds

        return () => clearInterval(timer);
    }, [suggestions.length, isHovered]);

    if (!suggestions || suggestions.length === 0) return null;

    // Slot 1: Pinned priority item
    const pinned = suggestions[0];

    // Slots 2 and 3: Rotated items
    let visibleRotation = [];
    if (suggestions.length <= 3) {
        visibleRotation = suggestions.slice(1);
    } else {
        visibleRotation = [
            suggestions[currentIndex],
            suggestions[currentIndex + 1 >= suggestions.length ? 1 : currentIndex + 1]
        ];
    }

    const renderButton = (item: any) => (
        <motion.button
            key={item.id}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onClick={() => onSelect(item.prompt)}
            className="bg-white/5 hover:bg-white/10 active:scale-95 border border-white/8 rounded-full px-2.5 py-1 text-[11px] text-white/80 transition-all flex items-center gap-1.5 cursor-pointer font-medium whitespace-nowrap"
        >
            <SvgIcon name={item.icon} size={11} className="text-gold flex-shrink-0" />
            <span>{item.label}</span>
        </motion.button>
    );

    return (
        <div
            className="flex flex-wrap gap-1.5 mt-1 px-1 justify-start"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {renderButton(pinned)}
            <AnimatePresence mode="popLayout">
                {visibleRotation.map(renderButton)}
            </AnimatePresence>
        </div>
    );
}

// --- Liquid Glass Island Sub-Component ---
// Renders as a flex-shrink-0 sub-header slot BELOW the panel header.
// This ensures voice controls are NEVER obstructed.
function LiquidGlassIsland({
    island,
    onDismiss,
    isFullscreen,
    onToggleFullscreen,
}: {
    island: IslandState;
    onDismiss: () => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    const [ipLocation, setIpLocation] = useState<{ lat: number, lng: number } | null>(null);

    useEffect(() => {
        if (island.mode === "MAP_VIEW" && !ipLocation) {
            fetch("https://get.geojs.io/v1/ip/geo.json")
                .then(res => res.json())
                .then(data => {
                    if (data.latitude && data.longitude) {
                        setIpLocation({ lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) });
                    }
                })
                .catch(err => console.error("GeoIP fetch failed", err));
        }
    }, [island.mode, ipLocation]);

    if (island.mode === "IDLE" || island.mode === "CHAT_ACTIVE") return null;
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={island.mode}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="overflow-hidden flex-shrink-0 border-b border-white/8"
                style={{
                    background: "rgba(10, 8, 6, 0.6)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                }}
            >
                {/* Control row: label + expand + dismiss */}
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.28em] text-gold/60">
                        {island.mode === "MAP_VIEW" ? (island.payload?.label || "Venue Location") :
                            island.mode === "LIVE_WAVEFORM" ? "Live Audio" : "Saved Offline"}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button onClick={onDismiss} className="text-white/25 hover:text-white/60 transition-colors" aria-label="Dismiss">
                            <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.8 13C7.35817 13 7 13.3582 7 13.8V14.2C7 14.6418 7.35817 15 7.8 15H20.2C20.6418 15 21 14.6418 21 14.2V13.8C21 13.3582 20.6418 13 20.2 13H7.8Z" fill="currentColor" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M14 1C6.82031 1 1 6.82031 1 14C1 21.1797 6.82031 27 14 27C21.1797 27 27 21.1797 27 14C27 6.82031 21.1797 1 14 1ZM3 14C3 7.9248 7.92578 3 14 3C20.0742 3 25 7.9248 25 14C25 20.0752 20.0742 25 14 25C7.92578 25 3 20.0752 3 14Z" fill="currentColor" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* MAP VIEW */}
                {island.mode === "MAP_VIEW" && island.payload?.lat != null && island.payload?.lng != null && (
                    <motion.div key="map-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="px-3 pb-3">
                        <div
                            className="w-full rounded-xl overflow-hidden transition-all duration-500 relative"
                            style={{ height: isFullscreen ? "55vh" : 148, background: "rgba(0,0,0,0.3)" }}
                        >
                            <iframe
                                title={island.payload.label || "Venue map"}
                                src={
                                    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY
                                        ? (ipLocation
                                            ? `https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY}&origin=${ipLocation.lat},${ipLocation.lng}&destination=${island.payload.lat},${island.payload.lng}&mode=driving`
                                            : `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY}&q=${island.payload.lat},${island.payload.lng}`)
                                        : (ipLocation
                                            ? `https://maps.google.com/maps?saddr=${ipLocation.lat},${ipLocation.lng}&daddr=${island.payload.lat},${island.payload.lng}&dirflg=d&output=embed`
                                            : `https://maps.google.com/maps?q=${island.payload.lat},${island.payload.lng}&z=15&output=embed`)
                                }
                                width="100%"
                                height="100%"
                                style={{ border: 0, borderRadius: 12, opacity: 0.93 }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />

                            {/* Start Navigation Overlay Button */}
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20 pointer-events-none">
                                <a
                                    href={ipLocation
                                        ? `https://www.google.com/maps/dir/?api=1&origin=${ipLocation.lat},${ipLocation.lng}&destination=${island.payload.lat},${island.payload.lng}&travelmode=driving`
                                        : `https://www.google.com/maps/dir/?api=1&destination=${island.payload.lat},${island.payload.lng}&travelmode=driving`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="pointer-events-auto bg-black/70 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/10 hover:bg-black/90 hover:border-gold/50 active:scale-95 transition-all text-gold px-4 py-2 rounded-full font-black uppercase text-[10px] tracking-wider flex items-center gap-1.5"
                                >
                                    <svg width="14" height="14" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fill="currentColor" d="M62.364,0.773c-0.694-0.509-1.526-0.772-2.366-0.772c-0.403,0-0.809,0.061-1.202,0.185l-9.276,2.93 c0.102,0.175,0.183,0.386,0.234,0.649c0.286,1.477-0.732,2.198-1.188,3.606c0.456,1.195,0.159,2.094,0.785,3.078 c0.584,0.893,1.581,0.5,1.995,1.545c0.637,1.586-0.393,3.215-1.592,4.108c-0.388,0.284-0.748,0.38-1.108,0.38 c-0.641,0-1.279-0.301-2.07-0.38c-2.212-0.213-3.385-0.97-5.555-1.546c-2.187-0.563-3.505-1.598-5.509-1.598 c-0.268,0-0.547,0.019-0.843,0.059c-1.607,0.233-3.03-0.151-3.975,1.539c-0.901,1.635-0.949,3.558,0,5.152 c0.817,1.345,1.889,1.174,3.179,1.532c0.56,0.154,1.05,0.206,1.517,0.206c0.947,0,1.794-0.213,2.901-0.213 c0.113,0,0.229,0.002,0.347,0.007c0.22,0.009,0.43,0.013,0.634,0.013c0.752,0,1.409-0.048,2.053-0.048 c0.907,0,1.787,0.095,2.869,0.55c1.321,0.55,1.836,1.601,3.178,2.061c0.495,0.169,0.945,0.233,1.372,0.233 c1.383,0,2.528-0.682,4.194-0.756c1.013-0.036,1.851-0.505,2.675-0.504c0.428,0,0.852,0.126,1.294,0.504 c1.146,1.004,0.541,2.926,1.581,4.114c0.881,1.024,1.613,1.312,2.78,1.546c0.528,0.101,1.002,0.196,1.451,0.196 c0.442,0,0.86-0.095,1.281-0.367V4C64,2.726,63.393,1.527,62.364,0.773z" />
                                        <path fill="currentColor" d="M46.773,14.112c0.515,0.052,0.955,0.162,1.309,0.252c0.166,0.042,0.384,0.097,0.505,0.113 c0.448-0.344,0.963-0.978,0.948-1.507c-0.477-0.184-1.27-0.527-1.872-1.448c-0.596-0.938-0.7-1.829-0.776-2.479 c-0.044-0.372-0.078-0.666-0.189-0.959c-0.163-0.426-0.175-0.896-0.034-1.329c0.223-0.688,0.527-1.231,0.772-1.667 c0.29-0.516,0.367-0.684,0.368-0.826c-0.127-0.028-0.285-0.059-0.415-0.082c-0.218-0.041-0.472-0.094-0.736-0.159L43,5.174v7.9 c0.274,0.094,0.548,0.188,0.794,0.275C44.813,13.714,45.619,14.001,46.773,14.112z" />
                                        <path fill="currentColor" d="M0,11v6.054c0.659,0.069,1.257,0.104,1.86,0.104c0.646,0,1.271-0.035,2.062-0.078l0.807-0.044 c0.425-0.023,0.847-0.168,1.335-0.335c0.661-0.228,1.412-0.484,2.314-0.484c0.725,0,1.437,0.173,2.098,0.504 c1.245,0.607,1.876,1.559,2.383,2.322c0.274,0.413,0.511,0.77,0.811,1.021c0.709,0.595,1.312,0.808,2.148,1.102 c0.826,0.292,1.763,0.622,2.845,1.348c0.894,0.601,1.636,1.149,2.338,1.737V0.475L2.617,7.247C1.045,7.826,0,9.324,0,11z" />
                                        <path fill="currentColor" d="M39.271,23.254c-0.229,0-0.467-0.004-0.716-0.015c-0.09-0.003-0.179-0.005-0.265-0.005 c-0.462,0-0.888,0.049-1.339,0.1c-0.488,0.056-0.993,0.113-1.562,0.113c-0.7,0-1.371-0.091-2.052-0.279 c-0.225-0.062-0.464-0.107-0.717-0.154c-1.016-0.191-2.55-0.479-3.646-2.281c-1.29-2.169-1.303-4.838-0.027-7.151 c1.267-2.267,3.243-2.387,4.551-2.466c0.312-0.019,0.605-0.037,0.898-0.079c0.375-0.052,0.75-0.077,1.114-0.077 c1.619,0,2.844,0.492,4.026,0.968c0.482,0.193,0.958,0.37,1.462,0.53V5.784L24.265,0.205C23.854,0.068,23.428,0,23,0v26.147 c0.383,0.402,0.779,0.836,1.213,1.329c0.519,0.591,0.866,1.182,1.146,1.657c0.334,0.567,0.521,0.873,0.81,1.06 c0.04,0.025,0.059,0.031,0.078,0.032c0.153,0,0.454-0.089,0.745-0.176c0.528-0.157,1.188-0.354,1.961-0.354 c0.571,0,1.128,0.109,1.669,0.33l0.347,0.143c1.569,0.643,3.521,1.443,4.364,4.208c0.527,1.7,0.525,3.133-0.001,4.777 c-0.387,1.233-1.182,1.86-1.657,2.234c-0.111,0.089-0.265,0.209-0.295,0.249l-0.017,0.052c-0.024,0.084,0.025,0.346,0.07,0.576 c0.123,0.635,0.309,1.595-0.14,2.712c-0.764,1.856-2.263,2.798-4.456,2.798c-0.229,0-0.461-0.009-0.689-0.023 c-1.413-0.083-2.312-0.787-2.968-1.302c-0.241-0.189-0.47-0.368-0.71-0.51c-0.576-0.34-1.048-0.718-1.47-1.091v13.345l17.796,5.62 c0.067,0.021,0.137,0.03,0.204,0.048V23.214c-0.183,0.004-0.362,0.007-0.552,0.014C40.075,23.24,39.688,23.254,39.271,23.254z" />
                                        <path fill="currentColor" d="M20.09,43.093c-0.058-0.004-0.114-0.009-0.17-0.012c-0.002,0.063-0.004,0.127-0.006,0.181 c-0.022,0.691-0.055,1.735-0.769,2.666c-0.82,1.09-1.949,1.666-3.265,1.666c-0.718,0-1.395-0.167-1.991-0.314l-0.363-0.088 c-1.226-0.279-1.983-1.005-2.537-1.534c-0.263-0.252-0.512-0.49-0.659-0.526c-0.365-0.088-0.682-0.164-0.861-0.164 c-0.043,0-0.122,0-0.3,0.072c-0.45,0.184-0.708,0.805-1.19,2.18c-0.151,0.434-0.31,0.884-0.489,1.333 c-0.162,0.41-0.198,0.939-0.235,1.5c-0.075,1.11-0.177,2.632-1.433,3.827C4.926,54.734,3.91,55.15,2.719,55.15 c-0.613,0-1.186-0.109-1.739-0.215l-0.104-0.021C0.57,54.854,0.281,54.782,0,54.7V60c0,1.274,0.607,2.473,1.636,3.227 C2.33,63.735,3.16,64,4,64c0.404,0,0.811-0.062,1.204-0.186L21,58.826V43.193c-0.111-0.041-0.222-0.063-0.34-0.068 C20.462,43.119,20.272,43.106,20.09,43.093z" />
                                        <path fill="currentColor" d="M54.77,41.25c-0.93-0.286-1.528-0.468-2.054-0.19c0.165,0.238,0.497,0.591,0.735,0.843 c0.9,0.954,2.132,2.26,1.539,3.812c-0.413,1.104-1.393,1.496-2.107,1.782c-0.679,0.271-0.833,0.373-0.87,0.572 c-0.038,0.209,0.021,0.279,0.055,0.32c0.193,0.231,0.798,0.464,1.717,0.464c1.042,0,2.11-0.295,2.721-0.751 c1.052-0.807,1.4-1.912,1.118-3.578C57.345,42.836,56.411,41.767,54.77,41.25z" />
                                        <path fill="currentColor" d="M60.979,30.936l-0.104-0.021c-1.498-0.3-2.675-0.772-3.893-2.189c-0.879-1.005-1.068-2.183-1.207-3.042 c-0.048-0.301-0.12-0.751-0.198-0.893c-0.146,0.012-0.427,0.09-0.676,0.158c-0.509,0.141-1.142,0.316-1.875,0.343 c-0.615,0.027-1.179,0.179-1.775,0.34c-0.728,0.196-1.553,0.418-2.508,0.418c-0.685,0-1.344-0.111-2.021-0.342 c-1.055-0.361-1.744-0.943-2.298-1.41c-0.379-0.32-0.653-0.551-1.007-0.698c-0.146-0.062-0.282-0.106-0.418-0.15V63.86 c0.088-0.023,0.178-0.036,0.265-0.065l18-6C62.898,57.25,64,55.722,64,54V30.948c-0.406,0.122-0.827,0.202-1.281,0.202 C62.105,31.15,61.533,31.041,60.979,30.936z M57.712,49.697c-0.973,0.727-2.438,1.156-3.928,1.156c-1.462,0-2.616-0.42-3.253-1.183 c-0.453-0.544-0.621-1.222-0.485-1.96c0.241-1.33,1.356-1.775,2.094-2.071c0.594-0.237,0.884-0.377,0.979-0.633 c0.147-0.386-0.616-1.195-1.122-1.731c-0.758-0.803-1.473-1.561-1.361-2.525c0.042-0.357,0.225-0.872,0.856-1.289 c0.562-0.366,1.151-0.543,1.804-0.543c0.691,0,1.332,0.196,2.01,0.404c2.427,0.763,3.889,2.44,4.29,4.872 C59.999,46.577,59.365,48.43,57.712,49.697z" />
                                        <path fill="currentColor" d="M12.384,21.596c-1.199-1.004-1.448-2.425-2.785-3.077c-0.437-0.219-0.837-0.302-1.221-0.302 c-1.145,0-2.145,0.739-3.539,0.816c-1.177,0.06-2.053,0.125-2.979,0.125c-0.572,0-1.169-0.027-1.86-0.094v33.519 c0.376,0.165,0.783,0.274,1.268,0.371c0.528,0.101,1.002,0.196,1.451,0.196c0.596,0,1.146-0.169,1.722-0.718 c1.184-1.127,0.521-2.926,1.188-4.616c0.817-2.041,1.099-3.943,2.786-4.63c0.393-0.158,0.725-0.22,1.054-0.22 c0.413,0,0.82,0.098,1.329,0.22c1.357,0.33,1.809,1.744,3.173,2.055c0.679,0.159,1.318,0.353,1.91,0.353 c0.609,0,1.168-0.206,1.666-0.868c0.685-0.893,0.037-2.268,0.79-3.078c0.437-0.475,0.872-0.576,1.357-0.576 c0.315,0,0.653,0.044,1.025,0.055c0.101,0.004,0.186,0.03,0.28,0.043v-14.21c-1.035-1.028-2.025-1.827-3.453-2.786 C15.631,22.888,14.193,23.113,12.384,21.596z" />
                                        <path fill="currentColor" d="M28.265,45.756c0.193,0.012,0.385,0.02,0.572,0.02c1.098,0,2.076-0.269,2.606-1.559 c0.43-1.072-0.335-1.951,0-3.091c0.376-1.333,1.57-1.265,1.979-2.569c0.414-1.291,0.403-2.287,0-3.587 c-0.615-2.02-1.974-2.432-3.57-3.098c-0.312-0.127-0.61-0.176-0.899-0.176c-0.952,0-1.805,0.529-2.706,0.529 c-0.376,0-0.761-0.092-1.165-0.354C24.04,31.198,23.747,30.17,23,29.161v12.98c0.759,0.649,1.463,1.474,2.484,2.075 C26.557,44.849,27.087,45.687,28.265,45.756z" />
                                    </svg>
                                    Start Navigation
                                </a>
                            </div>

                            {/* Expand Overlay Button */}
                            <div className="absolute bottom-3 right-3 flex justify-center z-20 pointer-events-none">
                                <button
                                    onClick={onToggleFullscreen}
                                    className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 hover:border-white/30 text-white/50 hover:text-white px-2.5 py-2.5 rounded-full transition-all active:scale-95"
                                    aria-label={isFullscreen ? "Collapse map" : "Expand map fullscreen"}
                                    title={isFullscreen ? "Collapse" : "Expand"}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        {isFullscreen ? (
                                            <path d="M5 14H10V19M19 10H14V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        ) : (
                                            <path d="M10 19H5V14M14 5H19V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        )}
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <p className="text-[8px] text-white/25 text-center mt-1 font-medium tracking-wide">
                            {island.payload.lat.toFixed(4)}, {island.payload.lng.toFixed(4)}
                        </p>
                    </motion.div>
                )}

                {/* LIVE WAVEFORM */}
                {island.mode === "LIVE_WAVEFORM" && (
                    <motion.div key="waveform-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="px-4 pb-4">
                        <div className="flex items-center gap-[3px] h-8">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <motion.div key={i} className="flex-1 rounded-full bg-gold/70" animate={{ scaleY: [0.2, 1, 0.3, 0.8, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.06, ease: "easeInOut" }} style={{ originY: "center", height: "100%" }} />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* OFFLINE TICKET */}
                {island.mode === "OFFLINE_TICKET" && island.payload?.items && (
                    <motion.div key="ticket-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="px-4 pb-4">
                        <div className="space-y-1.5">
                            {island.payload.items.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-gold/60 mt-1.5 flex-shrink-0" /><p className="text-[11px] text-white/80 leading-snug">{item}</p></div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

// --- AI Action Chips --- deep-link chips from suggestedActions payload
function ActionChips({
    actions,
    onAction,
}: {
    actions: { label: string; icon: string; action: { type: string; target: string } }[];
    onAction: (action: { type: string; target: string }) => void;
}) {
    if (!actions || actions.length === 0) return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.28 }}
            className="flex flex-wrap gap-1.5 px-1 mt-1"
        >
            {actions.map((item) => (
                <button
                    key={item.label}
                    onClick={() => onAction(item.action)}
                    className="flex items-center gap-1.5 bg-gold/10 hover:bg-gold/20 active:scale-95 border border-gold/25 rounded-full px-2.5 py-1 text-[11px] text-gold font-bold transition-all whitespace-nowrap"
                >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {item.label}
                </button>
            ))}
        </motion.div>
    );
}

//     Main AI Assistant Component                                               ¬
export default function AIAssistant({ onNavigate }: { onNavigate?: (url?: string) => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const { profile } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [inputText, setInputText] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Habari! I'm here to help you explore AFLEWO: our events, chapters, how to join, or anything else. What can I do for you?",
            timestamp: new Date(),
        },
    ]);

    //     Liquid Glass Island state machine                                         ¬
    // Atomic state: only one mode can be active at a time.
    const [islandState, setIslandState] = useState<IslandState>({ mode: "IDLE", payload: null });
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);
    const [suggestedActions, setSuggestedActions] = useState<{ label: string; icon: string; action: { type: string; target: string } }[]>([]);
    const [hasVoiceSupport, setHasVoiceSupport] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState("");
    const [isNavigating, setIsNavigating] = useState<{ type: string; target: string } | null>(null);
    const [activeSystemMessage, setActiveSystemMessage] = useState<string | null>(null);
    const [showSignInPill, setShowSignInPill] = useState(false);
    const [fabIsIdle, setFabIsIdle] = useState(false);
    // Voice is muted by default — users must opt-in to enable TTS
    const [isMuted, setIsMuted] = useState(true);
    const [isHeroVisible, setIsHeroVisible] = useState(true);
    const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
    const [showPersonalize, setShowPersonalize] = useState(false);

    // Slash commands
    const [slashSearch, setSlashSearch] = useState<string | null>(null);
    const [slashIndex, setSlashIndex] = useState(0);

    const PAGE_SUGGESTIONS = useMemo(() => Object.entries(PAGE_DICTIONARY).map(([name, path]) => ({ name, path })), []);
    const activeSlashSuggestions = useMemo(() => {
        return slashSearch !== null
            ? PAGE_SUGGESTIONS.filter((s: { name: string; path: string }) => s.name.includes(slashSearch))
            : [];
    }, [slashSearch, PAGE_SUGGESTIONS]);

    const aiChatLottieRef = useRef<LottieRefCurrentProps>(null);

    //     Network awareness                                                    ¬
    const { isLowBandwidth, isOnline } = useBandwidth();
    const { saveManifest } = useOfflineManifest();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const lottieRef = useRef<LottieRefCurrentProps>(null);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const hasSentRef = useRef(false);
    const wpFileInputRef = useRef<HTMLInputElement>(null);

    // Check for voice support
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            setHasVoiceSupport(!!SR);
            synthRef.current = window.speechSynthesis || null;
        }
    }, []);

    // Load persisted wallpaper
    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = localStorage.getItem(WP_STORAGE_KEY);
        if (saved) setChatWallpaper(saved === "null" ? null : saved);
    }, []);

    // Delay show sign-in pill to draw focus when chat is opened
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isOpen) {
            timer = setTimeout(() => {
                setShowSignInPill(true);
            }, 1000);
        } else {
            setShowSignInPill(false);
        }
        return () => clearTimeout(timer);
    }, [isOpen]);

    // Activity-based FAB opacity fade — mirrors Nav FAB behaviour
    useEffect(() => {
        if (isOpen) {
            setFabIsIdle(false);
            return;
        }
        const idleTimer = setTimeout(() => setFabIsIdle(true), 4000);
        const resetIdle = () => {
            setFabIsIdle(false);
            clearTimeout(idleTimer);
        };
        window.addEventListener("mousemove", resetIdle, { passive: true });
        window.addEventListener("touchstart", resetIdle, { passive: true });
        return () => {
            clearTimeout(idleTimer);
            window.removeEventListener("mousemove", resetIdle);
            window.removeEventListener("touchstart", resetIdle);
        };
    }, [isOpen]);

    // Hide FAB when hero section is visible — mirrors Nav FAB behaviour exactly
    useEffect(() => {
        const heroEl = document.getElementById("hero") || document.querySelector("[data-hero]");
        if (!heroEl) { setIsHeroVisible(false); return; }
        const obs = new IntersectionObserver(
            ([entry]) => setIsHeroVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );
        obs.observe(heroEl);
        return () => obs.disconnect();
    }, []);

    // Auto-scroll to latest message or when thinking
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isThinking]);

    // Auto-scroll to bottom only when listening STARTS, preventing robotic snap on exit
    useEffect(() => {
        if (isListening) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [isListening]);

    // Auto-focus input when panel opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // ------------------------------------ Navigation action executor ---------------------------------------------
    const executeAction = useCallback((action: NavigationAction) => {
        if (action.type === "navigate_to") {
            // BUG FIX: if already on the target page, abort navigation entirely
            // to prevent the isTransitioning overlay from getting permanently stuck.
            if (pathname === action.target) {
                setIsNavigating(null);
                setActiveSystemMessage(null);
                return;
            }
            if (onNavigate) onNavigate();
            router.push(action.target);
        } else if (action.type === "scroll_to") {
            const el = document.getElementById(action.target);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                // Fallback: if section not found on current page, navigate home and scroll
                if (onNavigate) onNavigate();
                router.push(`/#${action.target}`);
            }
        }
    }, [router, onNavigate, pathname]);

    // ------------------------------------ Text-to-speech ---------------------------------------------
    const speak = useCallback((text: string) => {
        if (isMuted) return;
        if (!synthRef.current) return;
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-KE";
        utterance.rate = 0.95;
        utterance.pitch = 1;
        // Prefer a natural voice if available
        const voices = synthRef.current.getVoices();
        const preferred = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("neural"))
            || voices.find(v => v.lang.startsWith("en-KE"))
            || voices.find(v => v.lang.startsWith("en-ZA"))
            || voices.find(v => v.lang.startsWith("en"));
        if (preferred) utterance.voice = preferred;
        synthRef.current.speak(utterance);
    }, [isMuted]);

    // ------------------------------------ Send message to backend ---------------------------------------------
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isThinking) return;

        const userMsg: Message = {
            id: `u-${Date.now()}`,
            role: "user",
            content: text.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText("");
        setVoiceTranscript("");
        setIsThinking(true);

        try {
            const history = [...messages, userMsg].map(m => ({
                role: m.role,
                content: m.content,
            }));

            const res = await fetch("/api/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: history,
                    currentPath: pathname,
                    lowBandwidth: isLowBandwidth,
                }),
            });

            const data = await res.json();

            // Cache any logistical info offline for use without a connection
            if (data.offlineManifest) {
                saveManifest(data.offlineManifest);
            }

            // Dispatch island state from AI trigger (atomic — one state at a time)
            if (data.islandTrigger) {
                const trigger = data.islandTrigger;
                if (trigger.mode === "map" && trigger.payload) {
                    setIslandState({ mode: "MAP_VIEW", payload: trigger.payload });
                } else if (trigger.mode === "waveform") {
                    setIslandState({ mode: "LIVE_WAVEFORM", payload: null });
                } else if (trigger.mode === "ticket") {
                    // Ticket uses the offline manifest items as payload
                    if (data.offlineManifest?.items) {
                        setIslandState({ mode: "OFFLINE_TICKET", payload: { items: data.offlineManifest.items } });
                    }
                }
            }

            // Parse suggestedActions from AI response — these are deep-link action chips
            if (Array.isArray(data.suggestedActions) && data.suggestedActions.length > 0) {
                setSuggestedActions(data.suggestedActions);
            } else {
                setSuggestedActions([]);
            };

            const assistantMsg: Message = {
                id: `a-${Date.now()}`,
                role: "assistant",
                content: data.message || "I'm here — could you ask that again?",
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);

            // Speak the response
            speak(assistantMsg.content);

            // Execute navigation action if present
            if (data.action) {
                const isScroll = data.action.type === "scroll_to";

                // Show visual overlay indicator
                setIsNavigating({
                    type: data.action.type,
                    target: data.action.target
                });

                // Show dynamic temporary system status
                setActiveSystemMessage(
                    isScroll
                        ? `Scrolling to ${data.action.target}`
                        : `Opening ${data.action.target.replace("/", "") || "home"} page`
                );

                setTimeout(() => {
                    executeAction(data.action);
                    setIsNavigating(null);

                    // Show finished temporary state
                    setActiveSystemMessage(
                        isScroll
                            ? `Arrived at ${data.action.target}`
                            : `Opened ${data.action.target.replace("/", "") || "home"} page`
                    );

                    // Clear the message to trigger ease-out animation
                    setTimeout(() => {
                        setActiveSystemMessage(null);
                    }, 1500);
                }, 1600);
            }
        } catch {
            const errMsg: Message = {
                id: `e-${Date.now()}`,
                role: "assistant",
                content: "Something went wrong, please try again.",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsThinking(false);
        }
    }, [messages, isThinking, speak, executeAction]);

    // ------------------------------------ Voice recognition ---------------------------------------------
    const startListening = useCallback(() => {
        if (!hasVoiceSupport || isListening) return;

        hasSentRef.current = false;

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SR();
        recognition.lang = "en-KE";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setIsListening(true);
            lottieRef.current?.play();
        };

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((r: any) => r[0].transcript)
                .join("");
            setVoiceTranscript(transcript);

            if (event.results[event.results.length - 1].isFinal && !hasSentRef.current) {
                hasSentRef.current = true;
                setIsListening(false);
                lottieRef.current?.stop();
                sendMessage(transcript);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
            lottieRef.current?.stop();
        };

        recognition.onend = () => {
            setIsListening(false);
            lottieRef.current?.stop();
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [hasVoiceSupport, isListening, sendMessage]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
        lottieRef.current?.stop();
    }, []);

    const handleNewChat = useCallback(() => {
        if (synthRef.current) {
            synthRef.current.cancel();
        }
        stopListening();
        setMessages([
            {
                id: `welcome-${Date.now()}`,
                role: "assistant",
                content: "Habari! I'm here to help you explore AFLEWO: our events, chapters, how to join, or anything else. What can I do for you?",
                timestamp: new Date(),
            },
        ]);
        setInputText("");
        setVoiceTranscript("");
    }, [stopListening]);

    // ------------------------------------ Input key handler ---------------------------------------------
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (slashSearch !== null && activeSlashSuggestions.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSlashIndex(prev => (prev + 1) % activeSlashSuggestions.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSlashIndex(prev => (prev - 1 + activeSlashSuggestions.length) % activeSlashSuggestions.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertSlashSuggestion(activeSlashSuggestions[slashIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setSlashSearch(null);
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputText);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInputText(val);
        const match = val.match(/(?:^|\s)\/([a-z0-9_-]*)$/i);
        if (match) {
            setSlashSearch(match[1].toLowerCase());
            setSlashIndex(0);
        } else {
            setSlashSearch(null);
        }
    };

    const insertSlashSuggestion = (suggestion: { name: string, path: string }) => {
        const match = inputText.match(/(?:^|\s)\/([a-z0-9_-]*)$/i);
        if (match) {
            const before = inputText.substring(0, match.index! + (inputText[match.index!] === ' ' ? 1 : 0));
            const newText = before + `[${suggestion.name}](${suggestion.path}) `;
            setInputText(newText);
            setSlashSearch(null);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    };

    // ------------------------------------ Render ---------------------------------------------
    return (
        <>
            {/* -------------------- Floating Trigger Button -------------------- */}
            <AnimatePresence>
                {!isOpen && !isHeroVisible && (
                    <motion.button
                        key="fab"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: fabIsIdle ? 0.28 : 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25, opacity: { duration: 1.2, ease: "easeInOut" } }}
                        onClick={() => { setIsOpen(true); setFabIsIdle(false); }}
                        aria-label="Open assistant"
                        className="fixed bottom-8 right-8 z-[150] w-16 h-16 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(212,175,55,0.15)] border border-white/10 hover:border-gold/40 cursor-pointer overflow-hidden transition-all duration-300 group"
                        style={{
                            background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)",
                            backdropFilter: "blur(24px)",
                            WebkitBackdropFilter: "blur(24px)"
                        }}
                        whileHover={{ scale: 1.08, opacity: 1 }}
                        whileTap={{ scale: 0.94 }}
                    >
                        {/* Premium Glossy Inset Ring */}
                        <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-white/20 to-transparent z-10 pointer-events-none" />

                        {/* Hover Ping Glow */}
                        <div className="absolute inset-0 rounded-full bg-gold transition-all duration-1000 ease-out opacity-0 group-hover:opacity-20 group-hover:animate-ping z-0 pointer-events-none" />

                        {/* Centered Icon */}
                        <div className="relative z-20 flex items-center justify-center">
                            <SvgIcon name="search-status-1" size={26} className="text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]" />
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* -------------------- Chat Panel -------------------- */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="panel"
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className="fixed bottom-8 right-8 z-[150] w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)] border border-white/10"
                        style={{
                            background: "hsl(20 14% 5% / 0.95)",
                            backdropFilter: "blur(32px)",
                            WebkitBackdropFilter: "blur(32px)",
                            maxHeight: "80vh",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        {/* Header is always first — island is always BELOW it, never overlapping voice controls */}

                        {/* -------------------- Panel Header -------------------- */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                {/* AI Chat Lottie avatar */}
                                <div className="w-10 h-10 relative flex-shrink-0 flex items-center justify-center">
                                    <Lottie
                                        lottieRef={aiChatLottieRef}
                                        animationData={aiChatData}
                                        loop={true}
                                        autoplay={true}
                                        style={{ width: 40, height: 40 }}
                                    />
                                </div>
                                <div>
                                    <p className="text-white font-black text-sm tracking-tight">AFLEWO Chatbox</p>
                                    <p className="text-white/40 text-[10px] font-medium tracking-wider uppercase">
                                        {isListening ? "Listening..." : isThinking ? "Thinking..." : "Ask me anything!"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {/* Mute TTS toggle */}
                                <button
                                    onClick={() => {
                                        setIsMuted(m => !m);
                                        if (!isMuted) synthRef.current?.cancel();
                                    }}
                                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isMuted
                                        ? "text-white/25 bg-white/5 hover:bg-white/10"
                                        : "text-white/40 hover:text-white hover:bg-white/10"
                                        }`}
                                    title={isMuted ? "Unmute voice" : "Mute voice"}
                                    aria-label={isMuted ? "Unmute voice" : "Mute voice"}
                                >
                                    {isMuted ? (
                                        <svg width="16" height="16" viewBox="-3.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                            <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                                                <g transform="translate(-156.000000, -309.000000)" fill="currentColor">
                                                    <path d="M169,335 C167.061,335 165.236,334.362 163.716,333.318 L162.31,334.742 C163.944,335.953 165.892,336.765 168,336.955 L168,339 L167,339 C166.448,339 166,339.448 166,340 C166,340.553 166.448,341 167,341 L171,341 C171.552,341 172,340.553 172,340 C172,339.448 171.552,339 171,339 L170,339 L170,336.955 C174.938,336.51 179.117,332.799 180,328 L178,328 C177.089,332.007 173.282,335 169,335 L169,335 Z M176,326 L176,320.739 L164.735,331.515 C165.918,332.432 167.386,333 169,333 C172.866,333 176,329.866 176,326 L176,326 Z M160.047,328.145 L160,328 L158,328 C158.109,328.596 158.271,329.175 158.478,329.733 L160.047,328.145 L160.047,328.145 Z M179.577,312.013 L155.99,334.597 L157.418,336.005 L181.014,313.433 L179.577,312.013 L179.577,312.013 Z M169,309 C165.134,309 162,312.134 162,316 L161.997,326.309 L175.489,313.401 C174.456,310.825 171.946,309 169,309 L169,309 Z"></path>
                                                </g>
                                            </g>
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="-5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                            <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                                                <g transform="translate(-107.000000, -309.000000)" fill="currentColor">
                                                    <path d="M118,333 C121.866,333 125,329.866 125,326 L125,316 C125,312.134 121.866,309 118,309 C114.134,309 111,312.134 111,316 L111,326 C111,329.866 114.134,333 118,333 L118,333 Z M129,328 L127,328 C126.089,332.007 122.282,335 118,335 C113.718,335 109.911,332.007 109,328 L107,328 C107.883,332.799 112.063,336.51 117,336.955 L117,339 L116,339 C115.448,339 115,339.448 116,341 L120,341 C120.552,341 121,340.553 121,340 C121,339.448 120.552,339 120,339 L119,339 L119,336.955 C123.937,336.51 128.117,332.799 129,328 L129,328 Z"></path>
                                                </g>
                                            </g>
                                        </svg>
                                    )}
                                </button>
                                {/* Personalize / Wallpaper */}
                                <button
                                    onClick={() => setShowPersonalize(p => !p)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${showPersonalize ? "text-gold bg-gold/10" : "text-white/40 hover:text-white hover:bg-white/10"
                                        }`}
                                    title="Personalize chat"
                                    aria-label="Personalize chat"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M15.7209 7.34884C15.7209 8.37634 14.888 9.2093 13.8605 9.2093C12.833 9.2093 12 8.37634 12 7.34884C12 6.32133 12.833 5.48837 13.8605 5.48837C14.888 5.48837 15.7209 6.32133 15.7209 7.34884Z" fill="currentColor" />
                                        <path d="M22 7.75375C22.0001 7.38007 22.0002 7.11208 21.9628 6.8759C21.8273 6.02056 21.3378 5.28723 20.6478 4.82926C20.5697 4.7774 20.4713 4.84508 20.4838 4.93803V4.93803C20.5838 5.6818 20.6011 6.56503 20.604 7.5288C20.6045 7.60793 20.6046 7.70163 20.6046 7.81395V7.97276V8.14596V15.854C20.6046 15.912 20.6046 15.9697 20.6046 16.0272V16.186C20.6046 16.2985 20.6045 16.3923 20.604 16.4715C20.6011 17.4352 20.5838 18.3183 20.4838 19.062V19.062C20.4713 19.1549 20.5697 19.2226 20.6478 19.1707C21.3378 18.7128 21.8273 17.9794 21.9628 17.1241C22.0002 16.8879 22.0001 16.6199 22 16.2463L22 16.186V7.81395L22 7.75375Z" fill="currentColor" />
                                        <path d="M3.39537 7.81395C3.39537 7.70183 3.3955 7.60826 3.39595 7.52923C3.39614 7.46877 3.39638 7.40864 3.39669 7.34883C3.40139 6.45503 3.42246 5.63526 3.5162 4.93803V4.93803C3.5287 4.84508 3.43032 4.7774 3.35218 4.82926C2.66215 5.28723 2.17271 6.02056 2.03724 6.8759C1.99984 7.11207 1.99991 7.38007 2.00001 7.75373L2.00002 7.81395V16.186L2.00001 16.2463C1.99991 16.6199 1.99984 16.8879 2.03724 17.1241C2.17271 17.9794 2.66215 18.7128 3.35218 19.1707C3.43032 19.2226 3.5287 19.1549 3.5162 19.062V19.062C3.42246 18.3647 3.40139 17.545 3.39669 16.6512C3.39638 16.5913 3.39614 16.5312 3.39595 16.4708C3.3955 16.3917 3.39537 16.2982 3.39537 16.186V16.0399C3.39535 15.9782 3.39536 15.9162 3.39536 15.854L3.39537 8.22802L3.39536 8.14598C3.39536 8.08375 3.39535 8.02179 3.39537 7.96011V7.81395Z" fill="currentColor" />
                                        <path fillRule="evenodd" clipRule="evenodd" d="M16.0853 2.10839C15.2789 1.99997 14.2535 1.99998 12.9813 2H11.0187C9.74655 1.99998 8.72114 1.99997 7.91466 2.10839C7.07735 2.22097 6.37235 2.4618 5.81243 3.02172C5.25251 3.58164 5.01168 4.28664 4.89911 5.12395C4.79068 5.93043 4.79069 6.95585 4.79071 8.22802V15.772C4.79069 17.0442 4.79068 18.0696 4.89911 18.876C5.01168 19.7134 5.25251 20.4184 5.81243 20.9783C6.37235 21.5382 7.07735 21.779 7.91466 21.8916C8.72114 22 9.74655 22 11.0187 22H12.9813C14.2534 22 15.2789 22 16.0853 21.8916C16.9226 21.779 17.6276 21.5382 18.1876 20.9783C18.7475 20.4184 18.9883 19.7134 19.1009 18.876C19.2093 18.0696 19.2093 17.0441 19.2093 15.772V8.22803C19.2093 6.95585 19.2093 5.93044 19.1009 5.12395C18.9883 4.28664 18.7475 3.58164 18.1876 3.02172C17.6276 2.4618 16.9226 2.22097 16.0853 2.10839ZM16.8085 16.6302L17.7946 17.6708C17.8134 17.134 17.8139 16.4954 17.8139 15.7209V8.27907C17.8139 6.9438 17.8125 6.01253 17.718 5.30988C17.6262 4.6273 17.4584 4.26584 17.2009 4.00838C16.9435 3.75093 16.582 3.58307 15.8994 3.4913C15.1968 3.39683 14.2655 3.39535 12.9302 3.39535H11.0698C9.7345 3.39535 8.80324 3.39683 8.10059 3.4913C7.41801 3.58307 7.05654 3.75093 6.79909 4.00838C6.54164 4.26584 6.37378 4.6273 6.28201 5.30988C6.18754 6.01253 6.18606 6.9438 6.18606 8.27907V12.904L6.18936 12.9007C7.10618 11.96 8.52458 12.0245 9.37271 13.019L12.313 16.4668C12.5485 16.7429 12.8584 16.7555 13.0961 16.5596L13.3005 16.3912C14.3764 15.5045 15.8517 15.6204 16.8085 16.6302Z" fill="currentColor" />
                                    </svg>
                                </button>

                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        stopListening();
                                        synthRef.current?.cancel();
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                    aria-label="Close"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* -- Map / Island Sub-Header (pinned below controls, expands downward) -- */}
                        <LiquidGlassIsland
                            island={islandState}
                            onDismiss={() => { setIslandState({ mode: "IDLE", payload: null }); setIsMapFullscreen(false); }}
                            isFullscreen={isMapFullscreen}
                            onToggleFullscreen={() => setIsMapFullscreen(f => !f)}
                        />

                        {/* -- Personalize Drawer -- */}
                        <AnimatePresence>
                            {showPersonalize && (
                                <motion.div
                                    key="personalize-drawer"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                                    className="overflow-hidden flex-shrink-0 border-b border-white/8"
                                >
                                    <div className="px-5 py-4 space-y-3">
                                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">Wallpaper</p>
                                        <div className="flex flex-wrap gap-2">
                                            {WALLPAPER_PRESETS.map(preset => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => {
                                                        const val = preset.value;
                                                        setChatWallpaper(val);
                                                        localStorage.setItem(WP_STORAGE_KEY, val ?? "null");
                                                    }}
                                                    title={preset.label}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex-shrink-0 ${chatWallpaper === preset.value
                                                        ? "border-gold scale-110 shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                                                        : "border-white/10 hover:border-white/30"
                                                        }`}
                                                    style={{ background: preset.value ?? preset.preview }}
                                                />
                                            ))}
                                            {/* Custom image upload */}
                                            <button
                                                onClick={() => wpFileInputRef.current?.click()}
                                                title="Custom image"
                                                className="w-8 h-8 rounded-full border-2 border-dashed border-white/20 hover:border-gold/50 transition-all flex items-center justify-center text-white/30 hover:text-gold"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                            </button>
                                        </div>
                                        <input
                                            ref={wpFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    const dataUrl = ev.target?.result as string;
                                                    const val = `url(${dataUrl})`;
                                                    setChatWallpaper(val);
                                                    try { localStorage.setItem(WP_STORAGE_KEY, val); } catch { /* quota */ }
                                                };
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                        {chatWallpaper !== null && (
                                            <button
                                                onClick={() => { setChatWallpaper(null); localStorage.setItem(WP_STORAGE_KEY, "null"); }}
                                                className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white/50 transition-colors"
                                            >
                                                Reset to default
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/*    Offline / Low-Bandwidth Status Banner    */}
                        <AnimatePresence>
                            {!isOnline && (
                                <motion.div
                                    key="offline-banner"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden flex-shrink-0 bg-red-950/60 border-b border-red-500/20"
                                >
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400 text-center py-2">
                                        You are offline. Showing cached info only.
                                    </p>
                                </motion.div>
                            )}
                            {isOnline && isLowBandwidth && (
                                <motion.div
                                    key="lowbw-banner"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden flex-shrink-0 bg-amber-950/50 border-b border-amber-500/20"
                                >
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/80 text-center py-2">
                                        Slow connection - minimal replies active
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/*    Messages Area    */}
                        <div
                            className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar flex flex-col gap-2.5"
                            style={{
                                minHeight: 0,
                                backgroundImage: chatWallpaper?.startsWith("url(") ? chatWallpaper : chatWallpaper ?? undefined,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                            }}
                        >
                            {messages.map((msg, index) => {
                                const isLast = index === messages.length - 1;
                                const isAssistant = msg.role === "assistant";
                                const isSystem = msg.role === "system";

                                if (isSystem) {
                                    return (
                                        <div key={msg.id} className="text-center my-1">
                                            <span className="inline-block px-3 py-1 bg-white/5 border border-white/8 rounded-full text-[11px] text-white/50 tracking-tight">
                                                {msg.content}
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={msg.id} className="space-y-2">
                                        <ChatBubble msg={msg} onNavigate={(url) => {
                                            if (url && pathname === url) return;
                                            if (onNavigate) onNavigate(url);
                                        }} />

                                        {/* Contextual suggestions + AI action chips under last assistant message */}
                                        {isLast && isAssistant && !isThinking && !isListening && (
                                            <div className="flex flex-col gap-2">
                                                {/* Deep-link action chips from AI suggestedActions payload */}
                                                <AnimatePresence>
                                                    {suggestedActions.length > 0 && (
                                                        <ActionChips
                                                            actions={suggestedActions}
                                                            onAction={(action) => executeAction(action as { type: "navigate_to" | "scroll_to"; target: string })}
                                                        />
                                                    )}
                                                </AnimatePresence>
                                                <DynamicSuggestions
                                                    suggestions={getContextualSuggestions(msg.content)}
                                                    onSelect={(prompt) => sendMessage(prompt)}
                                                />

                                                {/* Tiny guest sign-in encouragement badge */}
                                                <AnimatePresence>
                                                    {!profile && messages.length === 1 && showSignInPill && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.4, y: 12 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.8, y: 8 }}
                                                            transition={{
                                                                type: "spring",
                                                                stiffness: 420,
                                                                damping: 18,
                                                                mass: 0.6
                                                            }}
                                                            className="text-center mt-1"
                                                        >
                                                            <Link
                                                                href="/auth"
                                                                onClick={() => {
                                                                    if (onNavigate) onNavigate();
                                                                }}
                                                                className="inline-block px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] text-white/40 tracking-tight transition-all duration-300 ease-in-out hover:bg-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] hover:font-semibold"
                                                            >
                                                                Sign in to save your chat history
                                                            </Link>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Temporary dynamic system instruction notifications */}
                            <AnimatePresence>
                                {activeSystemMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ type: "spring", stiffness: 450, damping: 25 }}
                                        className="flex justify-center my-2.5 flex-shrink-0"
                                    >
                                        <span className="inline-block px-3 py-1 bg-gold/10 border border-gold/25 rounded-full text-[11px] text-gold font-medium tracking-tight shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                                            {activeSystemMessage}
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex flex-col">
                                {/* Listening indicator */}
                                <AnimatePresence>
                                    {isListening && (
                                        <motion.div
                                            key="listening-indicator"
                                            initial={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, y: 15, scale: 0.95 }}
                                            animate={{ opacity: 1, height: "auto", marginTop: 24, marginBottom: 24, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, y: 10, scale: 0.98 }}
                                            transition={{
                                                duration: 0.4, ease: [0.32, 0.72, 0, 1]
                                            }}
                                            className="flex flex-col items-center justify-center overflow-hidden w-full"
                                        >
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <div className="w-24 h-24 sm:w-32 sm:h-32 mb-2">
                                                    <Lottie
                                                        lottieRef={lottieRef}
                                                        animationData={fireMicData}
                                                        loop={true}
                                                        autoplay={true}
                                                        style={{ width: "100%", height: "100%" }}
                                                    />
                                                </div>
                                                {voiceTranscript && (
                                                    <div className="max-w-[85%] px-5 py-3 rounded-2xl text-[15px] bg-gold/15 text-white shadow-[0_4px_24px_rgba(212,175,55,0.15)] border border-gold/30 text-center font-medium mt-2">
                                                        "{voiceTranscript}"
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Thinking indicator */}
                                <AnimatePresence>
                                    {isThinking && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, height: 0 }}
                                            animate={{ opacity: 1, y: 0, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="flex justify-start mb-3 overflow-hidden"
                                        >
                                            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white/8 border border-white/10 flex items-center gap-1.5 mt-2">
                                                {[0, 1, 2].map(i => (
                                                    <motion.span
                                                        key={i}
                                                        className="w-1.5 h-1.5 rounded-full bg-gold/60"
                                                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                                                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/*    Input Area    */}
                        <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
                            <div className="flex items-end gap-2 relative">
                                {/* Slash Suggestions */}
                                <AnimatePresence>
                                    {slashSearch !== null && activeSlashSuggestions.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute bottom-full left-0 mb-2 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 flex flex-col max-h-48 overflow-y-auto min-w-[200px]"
                                        >
                                            {activeSlashSuggestions.map((s: { name: string; path: string }, idx: number) => (
                                                <button
                                                    key={s.path + idx}
                                                    onClick={() => insertSlashSuggestion(s)}
                                                    className={`px-3 py-2 text-left text-sm transition-colors ${idx === slashIndex ? "bg-gold/20 text-gold" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                                                >
                                                    <div className="font-medium capitalize">{s.name}</div>
                                                    <div className="text-[10px] opacity-50 font-mono">{s.path}</div>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Text input */}
                                <textarea
                                    ref={inputRef}
                                    value={inputText}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about AFLEWO..."
                                    rows={1}
                                    disabled={isListening || isThinking}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-gold/40 transition-colors duration-200 hide-scrollbar"
                                    style={{
                                        minHeight: "42px",
                                        maxHeight: "96px",
                                    }}
                                />

                                {/* Voice button */}
                                {hasVoiceSupport && (
                                    <div className="relative group">
                                        <button
                                            onClick={isListening ? stopListening : startListening}
                                            disabled={isThinking}
                                            aria-label={isListening ? "Stop listening" : "Start voice input"}
                                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${isListening
                                                ? "bg-gold/20 text-gold border border-gold/40 animate-pulse"
                                                : "bg-white/8 text-white/50 border border-white/10 hover:text-white hover:bg-white/15"
                                                }`}
                                        >
                                            <MicIcon active={isListening} />
                                        </button>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-black/80 border border-white/10 text-white text-[11px] font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                                            Tap to chat
                                        </div>
                                    </div>
                                )}

                                {/* Send button */}
                                <button
                                    onClick={() => sendMessage(inputText)}
                                    disabled={!inputText.trim() || isThinking || isListening}
                                    aria-label="Send message"
                                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gold text-brown transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gold/90 active:scale-95"
                                >
                                    <SendIcon />
                                </button>
                            </div>
                        </div>

                        {/*    Transition Overlay    */}
                        <AnimatePresence>
                            {isNavigating && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-center p-6 space-y-4"
                                >
                                    <div className="w-10 h-10 rounded-full border-t-2 border-gold border-r-2 border-transparent animate-spin" />
                                    <div>
                                        <p className="text-gold font-black uppercase tracking-widest text-[9px]">Transitioning</p>
                                        <p className="text-white text-sm font-medium mt-1">
                                            {isNavigating.type === "navigate_to"
                                                ? `Navigating to ${isNavigating.target.replace("/", "") || "Home"}...`
                                                : `Scrolling down to #${isNavigating.target}...`}
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

//     Suggestions Configuration
// Scored matching: each topic accumulates keyword hits; highest score wins.
// This prevents the first-match-wins ambiguity of a long if/else chain.
function getContextualSuggestions(text: string) {
    const lower = text.toLowerCase();
    const now = new Date();
    const hour = now.getHours();
    const isEvening = hour >= 17 || hour < 6; // 5 PM – 4 AM = likely event hours

    const liveEvent = events.find((e) => e.isLive);
    const liveChapterName = liveEvent?.chapter || "Eldoret";
    const liveTopicKey = liveChapterName.toLowerCase();

    const liveSuggestions = [
        { id: `live_${liveTopicKey}`, label: `🔴 ${liveChapterName} LIVE`, prompt: `Take me to the Media page to watch the AFLEWO ${liveChapterName} livestream.`, icon: "videocam" },
        { id: "live_youtube", label: "Watch on YouTube", prompt: "Take me to the Media page to watch the YouTube live stream.", icon: "youtube" },
        { id: "live_facebook", label: "Watch on Facebook", prompt: "Take me to the Media page to watch the Facebook live stream.", icon: "share" },
    ];

    type Suggestion = { id: string; label: string; prompt: string; icon: string };
    type Topic = { keywords: string[]; suggestions: Suggestion[] };

    const TOPICS: Record<string, Topic> = {
        join: {
            keywords: ["join", "choir", "audition", "register", "apply", "band", "media team", "ushering", "security", "dance"],
            suggestions: [
                { id: "join_choir", label: "Join Choir", prompt: "How do I register to join the AFLEWO choir?", icon: "church" },
                { id: "requirements", label: "Requirements", prompt: "What are the audition requirements for each team?", icon: "favorite" },
                { id: "serve_teams", label: "Other Teams", prompt: "How do I join the ushering, security, or media teams?", icon: "person_add" },
                { id: "partner", label: "Partner", prompt: "How can I financially partner with AFLEWO?", icon: "handshake" },
            ],
        },
        events: {
            keywords: ["event", "date", "calendar", "worship night", "schedule", "rehearsal", "next event", "upcoming", "when"],
            suggestions: [
                { id: "main_event", label: "Oct 2 Nairobi", prompt: "Tell me about the main AFLEWO Night on October 2nd, 2026 in Nairobi", icon: "calendar" },
                { id: "calendar_2026", label: "Full 2026 Schedule", prompt: "What is the full AFLEWO 2026 event calendar?", icon: "calendar" },
                { id: "nairobi_launch", label: "Pre-Launch", prompt: "Tell me about the Nairobi Pre-Launch event on April 10th", icon: "calendar" },
                liveSuggestions[0],
            ],
        },
        [liveTopicKey]: {
            keywords: [liveTopicKey, `${liveTopicKey} chapter`, `${liveTopicKey} live`, `${liveTopicKey} stream`],
            suggestions: [
                ...liveSuggestions,
                { id: `${liveTopicKey}_chapter`, label: `${liveChapterName} Chapter`, prompt: `Tell me about the AFLEWO ${liveChapterName} chapter`, icon: "location" },
            ],
        },
        chapters: {
            keywords: ["chapter", "nairobi", "mombasa", "nakuru", "rwanda", "tanzania", "nyeri", "meru", "kigali", "dar es salaam", "location", "where", "region"],
            suggestions: [
                { id: "chapters_list", label: "All Chapters", prompt: "Show me all 8 active AFLEWO chapters", icon: "location" },
                { id: "nairobi_chapter", label: "Nairobi", prompt: "Where is the Nairobi chapter based and when do they rehearse?", icon: "church" },
                { id: "mombasa_chapter", label: "Mombasa", prompt: "Tell me about the Mombasa AFLEWO Chapter then", icon: "location" },
                { id: "rwanda_chapter", label: "Rwanda", prompt: "Tell me about AFLEWO Rwanda Chapter", icon: "location" },
                { id: "meru_chapter", label: "Meru", prompt: "Tell me about AFLEWO Meru Chapter", icon: "location" },
                { id: "nakuru_chapter", label: "Nakuru", prompt: "Tell me about AFLEWO Nakuru Chapter", icon: "location" },
                { id: "nyeri_chapter", label: "Nyeri", prompt: "Tell me about AFLEWO Nyeri Chapter", icon: "location" },
                { id: "tanzania_chapter", label: "Tanzania", prompt: "Tell me about AFLEWO Tanzania Chapter", icon: "location" },
                { id: "kigali_chapter", label: "Kigali", prompt: "Tell me about AFLEWO Kigali Chapter in Rwanda", icon: "location" },
                { id: "dar_es_salaam_chapter", label: "Dar es Salaam", prompt: "Tell me about AFLEWO Dar es Salaam Chapter in Tanzania", icon: "location" },
            ],
        },
        live: {
            keywords: ["live", "stream", "watch", "streaming", "broadcast", "online", "youtube", "facebook"],
            suggestions: liveSuggestions,
        },
        media: {
            keywords: ["media", "video", "worship", "song", "music", "archive", "recording", "past"],
            suggestions: [
                { id: "media_archive", label: "Worship Archive", prompt: "Where can I watch past AFLEWO worship videos?", icon: "music" },
                { id: "stories", label: "Testify", prompt: "Show me AFLEWO community stories and testimonies", icon: "speech" },
                liveSuggestions[0],
            ],
        },
        donate: {
            keywords: ["donate", "mpesa", "partner", "support", "paybill", "give", "tithe", "offering", "financial"],
            suggestions: [
                { id: "donate_mpesa", label: "M-Pesa Paybill", prompt: "What is the AFLEWO M-Pesa paybill number?", icon: "wallet" },
                { id: "partner_tiers", label: "Partner Tiers", prompt: "What are the AFLEWO corporate partnership tiers?", icon: "handshake" },
                { id: "alumni", label: "Alumni Network", prompt: "How do I re-register as an AFLEWO alumni?", icon: "person_add" },
            ],
        },
    };

    // Score each topic against the reply text — highest score wins
    let bestTopic: string | null = null;
    let bestScore = 0;

    for (const [topicKey, topic] of Object.entries(TOPICS)) {
        const score = topic.keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
        if (score > bestScore) {
            bestScore = score;
            bestTopic = topicKey;
        }
    }

    if (bestTopic && bestScore > 0) {
        return TOPICS[bestTopic].suggestions;
    }

    // Default: evening surfaces live event first
    if (isEvening) {
        return [
            liveSuggestions[0],
            { id: "join", label: "Join Movement", prompt: "How do I register to join the AFLEWO choir?", icon: "church" },
            { id: "events", label: "Events", prompt: "What events are planned for AFLEWO 2026?", icon: "calendar" },
            { id: "chapters", label: "Chapters", prompt: "Show me all 8 active AFLEWO chapters", icon: "location" },
        ];
    }

    return [
        { id: "join", label: "Join Movement", prompt: "How do I register to join the AFLEWO choir?", icon: "church" },
        { id: "events", label: "2026 Events", prompt: "What events are planned for AFLEWO 2026?", icon: "calendar" },
        { id: "chapters", label: "Chapters", prompt: "Show me all 8 active AFLEWO chapters", icon: "location" },
        { id: "media", label: "Archive", prompt: "Where can I watch past worship videos?", icon: "music" },
    ];
}

