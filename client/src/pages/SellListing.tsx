import React, {
    useEffect,
    useRef,
    useState,
    forwardRef,
    useImperativeHandle,
    useMemo,
} from "react";
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import { FaSearch, FaDollarSign, FaBed, FaBath, FaThLarge, FaExpandAlt, FaCompressAlt } from "react-icons/fa";

// Firebase
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
    // updateDoc,
    // doc,
} from "firebase/firestore";
import { app, auth } from "../../firebase";

// --- MAP THEME ---
const mapStyle = [
    { elementType: "geometry", stylers: [{ color: "#f5f7fb" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#3b3f52" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "water", stylers: [{ color: "#e6f0ff" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#e9ecf3" }] },
    { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
];

// Firestore -> UI type
type FSProperty = {
    id: string;
    title?: string;
    address?: string;
    priceOrRent?: number;
    imageUrls?: string[];
    type?: "sale" | "rent";
    status?: "active" | "paused" | "closed";
    bed?: number | string;   // singular keys from Firestore
    bath?: number | string;
    lat?: number;
    lng?: number;
    ownerUid?: string; // seller uid
};

type UIProperty = {
    id: string; // propertyId
    title: string;
    location: string;
    price: string;
    image: string;   // cover image
    images: string[]; // all images
    bed: number;     // singular in UI as well
    bath: number;
    lat?: number;
    lng?: number;
    sellerUid?: string;
};

const Chip = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center rounded-full bg-[#FFFFFF] text-[#FF6D4D] px-3 py-1 text-xs font-medium ring-1 ring-inset ring-[#FF6D4D]">
        {children}
    </span>
);

const ListingHeader = ({
    onToggleMap,
    showMap,
    searchValue,
    onSearchChange,
}: {
    onToggleMap: () => void;
    showMap: boolean;
    searchValue: string;
    onSearchChange: (v: string) => void;
}) => (
    <header className="sticky top-0 z-20 backdrop-blur bg-white/90 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-grow">
                <div className="flex-grow relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by address, city, state, or ZIP"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-[#FF6D4D] focus:border-[#e85f41]"
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                <button
                    className="h-10 px-3 rounded-xl bg-[#FF6D4D] text-white hover:bg-[#e85f41] shadow-sm"
                    onClick={onToggleMap}
                    aria-label={showMap ? "Collapse map" : "Expand map"}
                >
                    {showMap ? <FaCompressAlt /> : <FaExpandAlt />}
                </button>
            </div>
        </div>
    </header>
);

const ListingCard = ({
    title, location, price, image, bed, bath, onClick, id, variant = "row"
}: {
    title: string;
    location: string;
    price: string;
    image: string;
    bed: number;
    bath: number;
    onClick: (id: string) => void;
    id: string;
    variant?: "row" | "grid";
}) => {
    const isGrid = variant === "grid";
    const safeBed = Number.isFinite(bed) ? bed : 0;
    const safeBath = Number.isFinite(bath) ? bath : 0;

    return (
        <div
            onClick={() => onClick(id)}
            className={
                isGrid
                    ? "group bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer shadow-lg hover:shadow-md transition-all duration-300"
                    : "group grid grid-cols-[160px,1fr] bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer shadow-lg hover:shadow-md transition-all duration-300"
            }
        >
            <div className={isGrid ? "relative h-44" : "relative h-40"}>
                <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute left-3 top-3">
                    <Chip>{safeBed} bd · {safeBath} ba</Chip>
                </div>
            </div>
            <div className={isGrid ? "p-4" : "p-4 flex flex-col justify-between"}>
                <div>
                    <p className="text-xl font-semibold text-slate-900 tracking-tight">
                        ${price}
                        {/* <span className="text-sm text-slate-500">/mo</span> */}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">{title}</p>
                    <p
                        className="text-xs text-slate-500 mt-1 underline underline-offset-2 decoration-dotted"
                        onClick={(e) => { e.stopPropagation(); onClick(id); }}
                        role="button"
                    >
                        {location}
                    </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-500">Listed today</div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[#FF6D4D] text-sm font-medium">
                        View details →
                    </button>
                </div>
            </div>
        </div>
    );
};

// Imperative API exposed by the map component
export type MapApi = {
    panToProperty: (p: UIProperty) => void;
    geocodeAndGetLatLng: (address: string) => Promise<{ lat: number; lng: number } | null>;
};

const PropertiesMap = forwardRef<MapApi, {
    properties: UIProperty[];
    activeId?: string | null;
    onMarkerClick?: (id: string) => void;
}>(({ properties, activeId, onMarkerClick }, ref) => {
    // Manhattan center
    const mapCenter = { lat: 40.7831, lng: -73.9712 };
    const mapRef = useRef<google.maps.Map | null>(null);
    const [infoId, setInfoId] = useState<string | null>(null);

    const onLoad = (map: google.maps.Map) => {
        mapRef.current = map;
        map.setCenter(mapCenter);
        map.setZoom(12);
    };

    useImperativeHandle(ref, () => ({
        panToProperty: (p: UIProperty) => {
            if (!mapRef.current || typeof p.lat !== "number" || typeof p.lng !== "number") return;
            mapRef.current.panTo({ lat: p.lat, lng: p.lng });
            mapRef.current.setZoom(14);
            setInfoId(p.id);
        },
        geocodeAndGetLatLng: async (address: string) => {
            if (!address?.trim()) return null;
            const geocoder = new google.maps.Geocoder();
            return new Promise((resolve) => {
                geocoder.geocode({ address }, (results, status) => {
                    if (status === "OK" && results && results[0]) {
                        const loc = results[0].geometry.location;
                        resolve({ lat: loc.lat(), lng: loc.lng() });
                    } else {
                        resolve(null);
                    }
                });
            });
        },
    }));

    const visibleProps = useMemo(
        () => properties.filter((p) => typeof p.lat === "number" && typeof p.lng === "number"),
        [properties]
    );

    return (
        <div className="h-full w-full">
            <GoogleMap
                center={mapCenter}
                zoom={12}
                onLoad={onLoad}
                mapContainerStyle={{ width: "100%", height: "100%" }}
                options={{ disableDefaultUI: true, zoomControl: true, styles: mapStyle, gestureHandling: "greedy" }}
            >
                {visibleProps.map((prop) => (
                    <MarkerF
                        key={prop.id}
                        position={{ lat: prop.lat!, lng: prop.lng! }}
                        onClick={() => {
                            setInfoId(prop.id);
                            onMarkerClick?.(prop.id);
                        }}
                    // icon={activeId === prop.id ? activePinUrl : undefined}
                    />
                ))}

                {infoId && (() => {
                    const p = properties.find((x) => x.id === infoId);
                    if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
                    const safeBed = Number.isFinite(p.bed) ? p.bed : 0;
                    const safeBath = Number.isFinite(p.bath) ? p.bath : 0;

                    return (
                        <InfoWindowF position={{ lat: p.lat, lng: p.lng }} onCloseClick={() => setInfoId(null)}>
                            <div className="text-sm">
                                <div className="font-semibold">{p.title}</div>
                                <div className="text-slate-600">{p.location}</div>
                                <div className="mt-1 font-medium">
                                    ${p.price}<span className="text-xs text-slate-500">/mo</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-600">{safeBed} bd · {safeBath} ba</div>
                                <button
                                    className="mt-2 rounded-md bg-[#FF6D4D] text-white px-3 py-1 text-xs"
                                    onClick={() => onMarkerClick?.(p.id)}
                                >
                                    View details
                                </button>
                            </div>
                        </InfoWindowF>
                    );
                })()}
            </GoogleMap>
        </div>
    );
});

const EmptyMapSkeleton = () => (
    <div className="h-full w-full bg-gradient-to-b from-slate-50 to-white animate-pulse grid place-items-center">
        <div className="text-slate-400 text-sm">Loading map…</div>
    </div>
);

// Shows targeted guidance if the Maps API rejects the key
const MapErrorBanner = ({ error, apiKey }: { error: unknown; apiKey?: string }) => {
    const msg = String((error as any)?.message || error || "");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const isTargetBlocked = msg.includes("ApiTargetBlockedMapError");
    const isNotActivated = msg.includes("ApiNotActivatedMapError");
    return (
        <div className="max-h-full grid place-items-center p-6 text-center">
            <div className="max-w-xl">
                <p className="text-lg font-semibold">Map failed to load</p>
                <p className="mt-2 text-sm text-slate-600 break-all">{msg}</p>
                {isTargetBlocked && (
                    <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 text-amber-900">
                        <p className="font-medium mb-2">Fix “ApiTargetBlockedMapError”</p>
                        <ol className="list-decimal ml-5 space-y-2 text-sm">
                            <li>
                                In <b>APIs & Services → Credentials → Your key</b>, under <b>Application restrictions</b> select
                                <b> HTTP referrers (web sites)</b> and add these referrers:
                                <div className="mt-1 grid text-xs bg-white rounded-lg border border-amber-200 p-2">
                                    <code>http://localhost:5173/*</code>
                                    <code>http://localhost:3000/*</code>
                                    <code>{origin}/*</code>
                                </div>
                            </li>
                            <li>
                                Under <b>API restrictions</b>, either choose <b>Don't restrict key</b> (to test) or
                                add <b>Maps JavaScript API</b> to the allowed list.
                            </li>
                            <li>
                                Make sure billing is enabled on the project and that you’re using a <b>Browser key</b> (not IP-restricted).
                            </li>
                        </ol>
                    </div>
                )}
                {isNotActivated && (
                    <div className="text-left bg-sky-50 border border-sky-200 rounded-xl p-4 mt-4 text-sky-900">
                        <p className="font-medium mb-2">Enable the API</p>
                        <p className="text-sm">Enable <b>Maps JavaScript API</b> in <b>APIs & Services → Library</b>, and attach a billing account.</p>
                    </div>
                )}
                {!apiKey && (
                    <p className="mt-4 text-slate-600 text-sm">Missing API key. Set <code>VITE_APP_Maps_API_KEY</code>.</p>
                )}
            </div>
        </div>
    );
};

/** --- Offer Detail Sheet --- */
const DetailPanel = ({
    property,
    onClose,
    onSendOffer,
    sending,
    sendError,
}: {
    property: UIProperty | null;
    onClose: () => void;
    onSendOffer: (amount: number) => Promise<void>;
    sending: boolean;
    sendError: string | null;
}) => {
    const [amount, setAmount] = useState<string>("");
    const [idx, setIdx] = useState(0);
    const images = property?.images?.length ? property.images : (property?.image ? [property.image] : []);

    useEffect(() => {
        setAmount("");
        setIdx(0);
    }, [property?.id]);

    const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
    const next = () => setIdx((i) => (i + 1) % images.length);

    const safeBed = Number.isFinite(property?.bed) ? (property!.bed as number) : 0;
    const safeBath = Number.isFinite(property?.bath) ? (property!.bath as number) : 0;

    return (
        <AnimatePresence>
            {property && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
                        onClick={onClose}
                    />

                    <motion.aside
                        key="sheet"
                        initial={{ x: 0, y: "100%" }}
                        animate={{ x: 0, y: 0 }}
                        exit={{ x: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 26, stiffness: 260 }}
                        className="fixed inset-x-0 bottom-0 lg:inset-y-0 lg:right-0 lg:left-auto z-50 w-full lg:w-[760px] xl:w-[900px] bg-white shadow-2xl border-t lg:border-l border-slate-200 rounded-t-2xl lg:rounded-none"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="p-4 sm:p-6 flex items-start justify-between border-b border-slate-200">
                            <div className="min-w-0">
                                <h3 className="text-xl font-semibold text-slate-900 truncate">{property.title}</h3>
                                <p className="text-sm text-slate-600 truncate">{property.location}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto h-[78vh] lg:h-full">
                            {/* Image carousel */}
                            <div className="relative w-full aspect-[16/9] bg-slate-100 rounded-xl overflow-hidden">
                                {images.length > 0 ? (
                                    <motion.img
                                        key={images[idx]}
                                        src={images[idx]}
                                        alt={`${property.title} ${idx + 1}/${images.length}`}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        initial={{ opacity: 0.3, scale: 1.02 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.25 }}
                                    />
                                ) : (
                                    <div className="grid place-items-center h-full text-slate-400">No photos</div>
                                )}

                                {images.length > 1 && (
                                    <>
                                        <button
                                            aria-label="Previous image"
                                            onClick={(e) => { e.stopPropagation(); prev(); }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur p-2 border border-slate-200 shadow hover:bg-white"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            aria-label="Next image"
                                            onClick={(e) => { e.stopPropagation(); next(); }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur p-2 border border-slate-200 shadow hover:bg-white"
                                        >
                                            ›
                                        </button>

                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                                            {images.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                                                    className={`h-2.5 w-2.5 rounded-full ${i === idx ? "bg-white shadow ring-1 ring-slate-300" : "bg-white/60"}`}
                                                    aria-label={`Go to image ${i + 1}`}
                                                />)
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-2xl font-semibold text-slate-900">
                                    ${property.price}<span className="text-base text-slate-500">/mo</span>
                                </p>
                                <Chip>{safeBed} bd · {safeBath} ba</Chip>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm text-slate-700 font-medium">Make an offer</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        placeholder="Amount (USD)"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#FF6D4D]"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                    <button
                                        disabled={sending || !amount}
                                        onClick={() => onSendOffer(Number(amount))}
                                        className="rounded-xl bg-[#FF6D4D] text-white px-4 py-2.5 hover:bg-[#e85f41] shadow-sm disabled:opacity-60"
                                    >
                                        {sending ? "Sending…" : "Send offer"}
                                    </button>
                                </div>
                                {sendError && <div className="text-xs text-red-600">{sendError}</div>}
                                <div className="text-xs text-slate-500">Currency: USD · Initial state: OFFER_SENT</div>
                            </div>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
};

const SellListing = () => {
    const navigate = useNavigate();
    const apiKey = import.meta.env.VITE_APP_Maps_API_KEY as string | undefined;
    const { isLoaded, loadError } = useJsApiLoader({ id: "google-map-script", googleMapsApiKey: apiKey || "" });

    // Firestore
    const db = getFirestore(app);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [properties, setProperties] = useState<UIProperty[]>([]);

    // Search/filter
    const [search, setSearch] = useState("");

    // Map/List resizing + collapse
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [mapPct, setMapPct] = useState(0.58);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [dragging, setDragging] = useState(false);

    // Selection state for detail panel
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = (properties.find((p) => p.id === selectedId) || null) as UIProperty | null;

    // offer sending state
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    // Map API ref
    const mapApiRef = useRef<MapApi | null>(null);

    // helper to coerce possibly-string numeric fields safely
    const toInt = (v: unknown, fallback = 0) => {
        const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
        return Number.isFinite(n) ? Math.trunc(n as number) : fallback;
    };

    // Load sale listings from Firestore
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const qRef = query(
                    collection(db, "properties"),
                    where("type", "==", "sale"),
                    where("status", "==", "active")
                );
                const snap = await getDocs(qRef);

                const items: UIProperty[] = snap.docs.map((docSnap) => {
                    const d = docSnap.data() as FSProperty;

                    const priceNum = typeof d.priceOrRent === "number" ? d.priceOrRent : 0;
                    const imgs = Array.isArray(d.imageUrls) ? d.imageUrls.filter(Boolean) : [];

                    // use singular keys from Firestore
                    const bedValue = toInt(d.bed, 0);
                    const bathValue = toInt(d.bath, 0);

                    return {
                        id: docSnap.id,
                        title: d.title || "Listed Home",
                        location: d.address || "—",
                        price: priceNum.toLocaleString("en-US"),
                        image: imgs[0] || "https://via.placeholder.com/1200x800?text=No+photo",
                        images: imgs.length ? imgs : ["https://via.placeholder.com/1200x800?text=No+photo"],
                        bed: bedValue,
                        bath: bathValue,
                        lat: d.lat,
                        lng: d.lng,
                        sellerUid: d.ownerUid,
                    };
                });

                setProperties(items);
                setError(null);
            } catch (e: any) {
                console.error(e);
                setError(e?.message || "Failed to load properties.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [db]);

    // Derived filtered list (simple client-side search on address string)
    const filtered = properties.filter((p) => {
        if (!search.trim()) return true;
        const hay = `${p.location} ${p.title}`.toLowerCase();
        return hay.includes(search.trim().toLowerCase());
    });

    const startDrag = (clientX: number) => {
        setDragging(true);
        updatePct(clientX);
    };
    const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); startDrag(e.clientX); };
    const onTouchStart = (e: React.TouchEvent) => { startDrag(e.touches[0].clientX); };

    const updatePct = (clientX: number) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const pct = x / rect.width;
        const clamped = Math.min(Math.max(pct, 0.2), 0.8);
        setMapPct(clamped);
        if (isCollapsed && clamped > 0.22) setIsCollapsed(false);
    };

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent | TouchEvent) => {
            const clientX = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            updatePct(clientX);
        };
        const onUp = () => setDragging(false);
        window.addEventListener("mousemove", onMove as any);
        window.addEventListener("mouseup", onUp);
        window.addEventListener("touchmove", onMove as any, { passive: false } as any);
        window.addEventListener("touchend", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove as any);
            window.removeEventListener("mouseup", onUp);
            window.removeEventListener("touchmove", onMove as any);
            window.removeEventListener("touchend", onUp);
        };
    }, [dragging]);

    const toggleCollapse = () => setIsCollapsed((v) => !v);
    const collapse = () => setIsCollapsed(true);

    // Send offer -> creates offers/{offerId}
    const sendOffer = async (amount: number) => {
        try {
            setSendError(null);
            if (!selected) return;
            if (!amount || amount <= 0) {
                setSendError("Enter a valid amount.");
                return;
            }
            const user = auth.currentUser;
            if (!user) {
                navigate("/login");
                return;
            }
            const buyerUid = user.uid;
            const sellerUid = selected.sellerUid;
            if (!sellerUid) {
                setSendError("Listing is missing seller information.");
                return;
            }
            setSending(true);

            await addDoc(collection(db, "offers"), {
                propertyId: selected.id,
                buyerUid,
                sellerUid,
                amount: Number(amount),
                currency: "USD",
                state: "OFFER_SENT",
                escrowAddress: "",
                createdAt: serverTimestamp(),
            });

            setSending(false);
            setSelectedId(null);
            alert("Offer sent!");
        } catch (e: any) {
            console.error(e);
            setSending(false);
            setSendError(e?.message || "Failed to send offer.");
        }
    };

    // When a listing or its address is clicked: geocode if needed, pan to marker, and open details
    const handlePropertyClick = async (id: string) => {
        const prop = properties.find((p) => p.id === id);
        if (!prop) return;

        // If no coords yet, geocode the address and update state (creates marker)
        if (typeof prop.lat !== "number" || typeof prop.lng !== "number") {
            try {
                const coords = await mapApiRef.current?.geocodeAndGetLatLng(prop.location);
                if (coords) {
                    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, lat: coords.lat, lng: coords.lng } : p)));
                    setTimeout(() => {
                        const updated: UIProperty = { ...prop, ...coords } as UIProperty;
                        mapApiRef.current?.panToProperty(updated);
                    }, 0);
                } else {
                    alert("Couldn't locate that address on the map.");
                }
            } catch (err) {
                console.error(err);
                alert("Geocoding failed. Please try again.");
            }
        } else {
            mapApiRef.current?.panToProperty(prop);
        }

        setSelectedId(id); // open the detail sheet
    };

    if (loadError) {
        return <MapErrorBanner error={loadError} apiKey={apiKey} />;
    }

    return (
        <div className="h-screen flex flex-col ">
            <Navbar />
            <ListingHeader
                onToggleMap={toggleCollapse}
                showMap={!isCollapsed}
                searchValue={search}
                onSearchChange={setSearch}
            />

            <main
                ref={containerRef}
                className="flex-grow overflow-hidden lg:grid grid-cols-1"
                style={{
                    gridTemplateColumns: isCollapsed ? "0px 1fr" : `${Math.round(mapPct * 100)}% 1fr`,
                    transition: dragging ? "none" : "grid-template-columns 200ms ease",
                }}
            >
                {/* Map column */}
                <div className={`hidden lg:block h-full min-h=[320px] relative ${isCollapsed ? "pointer-events-none" : ""}`}>
                    <button
                        onClick={toggleCollapse}
                        className="absolute top-4 right-4 z-10 rounded-full bg-white/90 backdrop-blur border border-slate-200 shadow px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                        aria-label={isCollapsed ? "Show map" : "Hide map"}
                    >
                        {isCollapsed ? "Show map" : "Hide map"}
                    </button>

                    {isLoaded && !isCollapsed ? (
                        <PropertiesMap
                            ref={mapApiRef}
                            properties={filtered}
                            activeId={selectedId}
                            onMarkerClick={setSelectedId}
                        />
                    ) : (
                        !isCollapsed && <EmptyMapSkeleton />
                    )}

                    {!isCollapsed && (
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            onMouseDown={onMouseDown}
                            onDoubleClick={collapse}
                            onTouchStart={onTouchStart}
                            className="absolute top-0 right-[-6px] h-full w-3 cursor-col-resize grid place-items-center"
                        >
                            <div className="h-16 w-1.5 rounded-full bg-slate-300/70 hover:bg-slate-400" />
                        </div>
                    )}
                </div>

                {/* List column */}
                <div className="h-full overflow-y-auto p-4 sm:p-6 bg-gradient-to-b from-white to-slate-50">
                    <div className="flex items-baseline justify-between mb-4">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                            {loading ? "Loading…" : error ? "Couldn't load" : `${filtered.length} Places for Sale`}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button onClick={toggleCollapse} className="lg:hidden rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
                                {isCollapsed ? "Show map" : "Hide map"}
                            </button>
                            <select className="text-sm rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#FF6D4D]">
                                <option>Sort: Featured</option>
                                <option>Price: Low to High</option>
                                <option>Price: High to Low</option>
                            </select>
                        </div>
                    </div>

                    {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

                    <div className={isCollapsed ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}>
                        {(loading ? [] : filtered).map((property) => (
                            <ListingCard
                                key={property.id}
                                {...property}
                                onClick={handlePropertyClick}
                                variant={isCollapsed ? "grid" : "row"}
                            />
                        ))}
                    </div>
                </div>
            </main>

            {/* Detail sheet with offer form */}
            <DetailPanel
                property={selected}
                onClose={() => setSelectedId(null)}
                onSendOffer={sendOffer}
                sending={sending}
                sendError={sendError}
            />
        </div>
    );
};

export default SellListing;
