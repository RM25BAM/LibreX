import React, { useEffect, useMemo, useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBuilding,
  FaCreditCard,
  FaFileUpload,
  FaIdCard,
  FaPlusCircle,
  FaTags,
  FaTimes,
  FaCheckCircle,
  FaHourglassHalf,
  FaCircle,
  FaEye,
  FaWallet,
} from "react-icons/fa";

// Firebase singletons from your firebase.ts
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage } from "../../firebase";
import { getFirestore } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const db = getFirestore();

/* ==========================================================
   Shared Types (align with your existing SalesDashboard types)
   ========================================================== */
export interface AppUser {
  uid: string;
  email: string;
  username: string;
  roles: Array<"buyer" | "seller" | "tenant" | "landlord" | "buyer_seller">;
  activeRole: "buyer" | "seller" | "tenant" | "landlord" | "buyer_seller";
  xrplAddress?: string;
  evmAddress?: string;
  walletType?: "email" | "metamask" | "xumm" | "crossmark" | "dynamyx";
}

export type ListingType = "sale" | "rent";
export type ListingStatus = "active" | "paused" | "closed";

export type PropertyDoc = {
  id: string;
  ownerUid: string;
  type: ListingType;
  priceOrRent: number;
  address: string;
  status: ListingStatus;
  imageUrls?: string[];
  bed: number;
  bath: number;
  details: string;
  lat?: number;
  lng?: number;
};

// Rental Application model
export type ApplicationStatus =
  | "submitted"
  | "deposit_accepted"
  | "id_verified"
  | "income_verified"
  | "lease_signed"
  | "escrow_funded"
  | "complete";

export interface RentalApplicationDoc {
  id: string;
  propertyId: string;
  tenantUid: string;
  landlordUid: string;
  createdAt?: any;
  status: ApplicationStatus;
  depositAmount?: number; // USD the landlord asked for
  minIncomeYearly?: number; // landlord-required threshold for income verify
  idvStatus?: "pending" | "verified" | "failed" | "not_started";
  taxDocUrls?: string[];
  escrowId?: string;
}

/* ==========================================================
   Tiny UI Primitives
   ========================================================== */
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white shadow-sm rounded-2xl ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 sm:p-5 border-b border-slate-200 ${className}`}>{children}</div>
);
const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-slate-800">{children}</h3>
);
const CardContent = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 sm:p-5 ${className}`}>{children}</div>
);

const Button = ({
  children,
  variant = "primary",
  className = "",
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`px-4 h-10 text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${variant === "primary"
        ? "bg-[#FF6D4D] text-white hover:bg-[#e85f41]"
        : variant === "danger"
          ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
      } ${className}`}
  >
    {children}
  </button>
);

const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${className}`}>{children}</span>
);

const TableLike = ({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          {columns.map((c) => (
            <th key={c} className="p-3 text-left font-semibold text-slate-600">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-slate-50">
            {row.map((cell, j) => (
              <td key={j} className="p-3 text-slate-700 truncate">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ==========================================================
   Firebase helpers
   ========================================================== */
async function fetchUser(uid: string): Promise<AppUser> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User profile not found");
  const d = snap.data() as any;
  return {
    uid,
    email: d.email || "",
    username: d.username || "",
    roles: (d.roles || []) as AppUser["roles"],
    activeRole: (d.activeRole || "tenant") as AppUser["activeRole"],
    xrplAddress: d.xrplAddress,
    evmAddress: d.evmAddress,
    walletType: d.walletType,
  };
}

async function fetchRentListingsForLandlord(ownerUid: string): Promise<PropertyDoc[]> {
  const qy = query(
    collection(db, "properties"),
    where("ownerUid", "==", ownerUid),
    where("type", "==", "rent")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PropertyDoc, "id">) }));
}

async function fetchApplicationsByUser(uid: string, as: "tenant" | "landlord") {
  const field = as === "tenant" ? "tenantUid" : "landlordUid";
  const qy = query(
    collection(db, "rental_applications"),
    where(field, "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RentalApplicationDoc, "id">) }));
}

async function createApplication(payload: Omit<RentalApplicationDoc, "id">) {
  const ref = doc(collection(db, "rental_applications"));
  const base = { ...payload, createdAt: serverTimestamp() } as any;
  await setDoc(ref, base);
  return { id: ref.id, ...(base as RentalApplicationDoc) };
}

async function setDepositAccepted(applicationId: string, minIncomeYearly: number, depositAmount: number) {
  const ref = doc(db, "rental_applications", applicationId);
  await updateDoc(ref, {
    status: "deposit_accepted",
    minIncomeYearly,
    depositAmount,
  });
}

async function markIdVerified(applicationId: string) {
  const ref = doc(db, "rental_applications", applicationId);
  await updateDoc(ref, { idvStatus: "verified", status: "id_verified" });
}

async function uploadTaxDocs(applicationId: string, files: File[]) {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const safe = `${Date.now()}_${i}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const sref = storageRef(storage, `applications/${applicationId}/tax-docs/${safe}`);
    await uploadBytes(sref, f);
    const url = await getDownloadURL(sref);
    urls.push(url);
  }
  const ref = doc(db, "rental_applications", applicationId);
  const snap = await getDoc(ref);
  const existing = (snap.exists() ? (snap.data() as any).taxDocUrls : []) || [];
  const merged = [...existing, ...urls];
  await updateDoc(ref, { taxDocUrls: merged, status: "income_verified" });
  return merged;
}

/* ==========================================================
   Timeline Modal (with ID Verify + Tax Upload actions)
   ========================================================== */
interface TimelineProps {
  app: RentalApplicationDoc | null;
  onClose: () => void;
  onDoIdVerify: (appId: string) => Promise<void>;
  onUploadTaxes: (appId: string, files: File[]) => Promise<void>;
}

const getStepIcon = (state: "complete" | "inprogress" | "pending") => {
  if (state === "complete") return <FaCheckCircle className="text-green-500" />;
  if (state === "inprogress") return <FaHourglassHalf className="text-blue-500 animate-spin" />;
  return <FaCircle className="text-slate-300" />;
};

const ApplicationTimelineModal: React.FC<TimelineProps> = ({ app, onClose, onDoIdVerify, onUploadTaxes }) => {
  const [localFiles, setLocalFiles] = useState<File[]>([]);

  // Build readable steps from app state
  const steps = useMemo(() => {
    const afterDeposit = app?.status !== undefined && ["deposit_accepted", "id_verified", "income_verified", "lease_signed", "escrow_funded", "complete"].includes(app.status);

    return [
      { id: 1, name: "Application Submitted", desc: "Tenant applied for this rental.", state: app ? "complete" : "pending" },
      { id: 2, name: "Deposit Accepted", desc: afterDeposit ? `Landlord accepted deposit. Minimum income: $${(app?.minIncomeYearly || 0).toLocaleString()}` : "Waiting for landlord to accept deposit.", state: afterDeposit ? "complete" : "pending" },
      { id: 3, name: "Identity Verification", desc: app?.idvStatus === "verified" ? "ID verified." : "Tenant must verify identity.", state: app?.status === "id_verified" || app?.status === "income_verified" || app?.status === "lease_signed" || app?.status === "escrow_funded" || app?.status === "complete" ? "complete" : afterDeposit ? "inprogress" : "pending" },
      { id: 4, name: "Income Verification (Taxes)", desc: (app?.taxDocUrls?.length || 0) > 0 ? `${app?.taxDocUrls?.length} document(s) uploaded.` : "Upload last year's taxes to prove income.", state: app?.status === "income_verified" || app?.status === "lease_signed" || app?.status === "escrow_funded" || app?.status === "complete" ? "complete" : afterDeposit ? "inprogress" : "pending" },
      { id: 5, name: "Lease Signing", desc: "Sign the lease (off-platform or integrate e-sign).", state: app?.status === "lease_signed" || app?.status === "escrow_funded" || app?.status === "complete" ? "complete" : "pending" },
      { id: 6, name: "Escrow Funded", desc: "Move-in funds deposited into escrow.", state: app?.status === "escrow_funded" || app?.status === "complete" ? "complete" : "pending" },
      { id: 7, name: "Complete", desc: "Keys handed over.", state: app?.status === "complete" ? "complete" : "pending" },
    ];
  }, [app]);

  const canShowSensitive = (app && ["deposit_accepted", "id_verified", "income_verified", "lease_signed", "escrow_funded", "complete"].includes(app.status)) ?? false;

  return (
    <AnimatePresence>
      {app && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl"
          >
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Rental Application Timeline</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Application for property #{app.propertyId}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
                <FaTimes />
              </button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 relative pl-8">
                <div className="absolute left-4 top-2 h-full w-0.5 bg-slate-200" />
                <div className="space-y-8">
                  {steps.map((s) => (
                    <div key={s.id} className="relative flex items-start gap-4">
                      <div className="absolute left-[-2px] top-1 h-8 w-8 bg-white rounded-full flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                          {getStepIcon(s.state as any)}
                        </div>
                      </div>
                      <div className="ml-8">
                        <p className="font-semibold text-slate-800">{s.name}</p>
                        <p className="text-sm text-slate-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-1 space-y-4">
                {!canShowSensitive && (
                  <div className="text-sm text-slate-500">
                    This application is waiting for the landlord to accept a deposit before verification steps are available.
                  </div>
                )}

                {canShowSensitive && (
                  <>
                    {/* ID Verify Action (stub) */}
                    <Card className="border border-slate-200">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FaIdCard /> Identity Verification
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-slate-600">
                          {app.idvStatus === "verified"
                            ? "Your identity is verified."
                            : "Verify your identity to continue."}
                        </p>
                        <Button
                          variant={app.idvStatus === "verified" ? "secondary" : "primary"}
                          disabled={app.idvStatus === "verified"}
                          onClick={() => onDoIdVerify(app.id)}
                        >
                          <FaIdCard /> {app.idvStatus === "verified" ? "Verified" : "Start ID Verify"}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Taxes Upload */}
                    <Card className="border border-slate-200">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FaFileUpload /> Upload Taxes (Income Proof)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          multiple
                          onChange={(e) => setLocalFiles(Array.from(e.target.files || []))}
                          className="block w-full text-sm text-slate-600"
                        />
                        <Button
                          variant="primary"
                          disabled={localFiles.length === 0}
                          onClick={() => onUploadTaxes(app.id, localFiles)}
                        >
                          <FaFileUpload /> Upload & Submit
                        </Button>
                        {(app.taxDocUrls?.length || 0) > 0 && (
                          <div className="text-xs text-slate-500">
                            Uploaded: {app.taxDocUrls!.length} document(s)
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </CardContent>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ==========================================================
   Stats Bar (Offers, Escrows)
   ========================================================== */
const StatCard = ({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) => (
  <Card>
    <CardContent className="flex items-center justify-between p-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      </div>
      <div className="text-slate-400 text-2xl">{icon}</div>
    </CardContent>
  </Card>
);

const StatsBar = ({ offers, escrows }: { offers: number; escrows: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard label="Active Applications" value={offers} icon={<FaTags />} />
    <StatCard label="Open Escrows" value={escrows} icon={<FaWallet />} />
    <StatCard label="Approved Tenants" value={<span className="text-green-600">—</span>} icon={<FaCheckCircle />} />
    <StatCard label="Pending Verifications" value={<span>—</span>} icon={<FaHourglassHalf />} />
  </div>
);

/* ==========================================================
   List Views (Landlord & Tenant)
   ========================================================== */
const LandlordRentListings = ({ listings, onNewApp }: { listings: PropertyDoc[]; onNewApp: (propertyId: string) => void }) => (
  <Card>
    <CardHeader>
      <CardTitle>My Rental Listings</CardTitle>
    </CardHeader>
    <CardContent>
      <TableLike
        columns={["Address", "Rent", "Beds", "Baths", "Status", "Actions"]}
        rows={
          listings.length === 0
            ? [[<span key="n/a" className="text-slate-500">No rental listings yet.</span>, "", "", "", "", ""]]
            : listings.map((l) => [
              l.address,
              l.priceOrRent?.toLocaleString?.("en-US", { style: "currency", currency: "USD" }) ?? "-",
              l.bed,
              l.bath,
              l.status === "active" ? (
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              ) : l.status === "paused" ? (
                <Badge className="bg-amber-100 text-amber-800">Paused</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-800">Closed</Badge>
              ),
              <Button key={l.id} variant="secondary" onClick={() => onNewApp(l.id)}>
                <FaPlusCircle /> New Application (mock)
              </Button>,
            ])
        }
      />
    </CardContent>
  </Card>
);

const ApplicationsTable = ({
  apps,
  role,
  onOpenTimeline,
  onAcceptDeposit,
}: {
  apps: RentalApplicationDoc[];
  role: "tenant" | "landlord";
  onOpenTimeline: (a: RentalApplicationDoc) => void;
  onAcceptDeposit: (a: RentalApplicationDoc) => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{role === "tenant" ? "My Applications" : "Incoming Applications"}</CardTitle>
    </CardHeader>
    <CardContent>
      <TableLike
        columns={["Property", role === "tenant" ? "Landlord" : "Tenant", "Status", "Actions"]}
        rows={
          apps.length === 0
            ? [[<span key="na" className="text-slate-500">No applications yet.</span>, "", "", ""]]
            : apps.map((a) => [
              `#${a.propertyId}`,
              role === "tenant" ? a.landlordUid : a.tenantUid,
              <Badge key={a.id} className="bg-slate-100 text-slate-800 capitalize">{a.status.replace(/_/g, " ")}</Badge>,
              <div key={`actions-${a.id}`} className="flex gap-2">
                <Button variant="secondary" onClick={() => onOpenTimeline(a)}>
                  <FaEye /> Timeline
                </Button>
                {role === "landlord" && a.status === "submitted" && (
                  <Button variant="primary" onClick={() => onAcceptDeposit(a)}>
                    Accept Deposit
                  </Button>
                )}
              </div>,
            ])
        }
      />
    </CardContent>
  </Card>
);

/* ==========================================================
   Payments (placeholder)
   ========================================================== */
const Payments = () => (
  <Card>
    <CardHeader>
      <CardTitle>Payments & Wallets</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-slate-600 text-sm">Hook up your existing payments flow here (escrow provider, XRPL/EVM wallets, etc.).</div>
    </CardContent>
  </Card>
);

/* ==========================================================
   Main RentDashboard
   ========================================================== */
const RentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeRole, setActiveRole] = useState<"tenant" | "landlord">("tenant");
  const [activeView, setActiveView] = useState<"rentals" | "applications" | "payments">("applications");

  const [listings, setListings] = useState<PropertyDoc[]>([]);
  const [apps, setApps] = useState<RentalApplicationDoc[]>([]);

  const [selectedApp, setSelectedApp] = useState<RentalApplicationDoc | null>(null);

  // Persist auth session across reloads
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => { });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setUser(null);
          setLoadingUser(false);
          return;
        }
        const profile = await fetchUser(u.uid);
        setUser(profile);
        const role: "tenant" | "landlord" = profile.activeRole === "landlord" ? "landlord" : "tenant";
        setActiveRole(role);
        setActiveView(role === "landlord" ? "rentals" : "applications");
      } catch (e) {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    });
    return () => unsub();
  }, []);

  // Load data for view
  useEffect(() => {
    (async () => {
      if (!user) return;
      if (activeRole === "landlord") {
        const ls = await fetchRentListingsForLandlord(user.uid);
        setListings(ls);
        const as = await fetchApplicationsByUser(user.uid, "landlord");
        setApps(as);
      } else {
        const as = await fetchApplicationsByUser(user.uid, "tenant");
        setApps(as);
      }
    })();
  }, [user, activeRole]);

  const offersCount = apps.length;
  const escrowsCount = apps.filter((a) => a.status === "escrow_funded" || a.status === "complete").length;

  // Actions
  const handleCreateMockApplication = async (propertyId: string) => {
    if (!user) return;
    const payload: Omit<RentalApplicationDoc, "id"> = {
      propertyId,
      tenantUid: "mock-tenant", // replace with real tenant in your flow
      landlordUid: user.uid,
      status: "submitted",
      idvStatus: "not_started",
      taxDocUrls: [],
    } as any;
    const created = await createApplication(payload);
    setApps((p) => [created, ...p]);
  };

  const handleAcceptDeposit = async (a: RentalApplicationDoc) => {
    const minIncome = Number(prompt("Minimum yearly income required (USD)?", "60000") || "0");
    const dep = Number(prompt("Deposit amount (USD)?", "1000") || "0");
    await setDepositAccepted(a.id, minIncome, dep);
    setApps((p) => p.map((x) => (x.id === a.id ? { ...x, status: "deposit_accepted", minIncomeYearly: minIncome, depositAmount: dep } : x)));
  };

  const handleDoIdVerify = async (appId: string) => {
    // Integrate your vendor here (Persona, Onfido, Stripe Identity, etc.)
    // For now we mark as verified.
    await markIdVerified(appId);
    setApps((p) => p.map((x) => (x.id === appId ? { ...x, idvStatus: "verified", status: "id_verified" } : x)));
  };

  const handleUploadTaxes = async (appId: string, files: File[]) => {
    const urls = await uploadTaxDocs(appId, files);
    setApps((p) => p.map((x) => (x.id === appId ? { ...x, taxDocUrls: urls, status: "income_verified" } : x)));
    alert("Taxes uploaded.");
  };

  const sidebar = [
    { name: "Rentals", view: "rentals", roles: ["landlord"] as const, icon: <FaBuilding /> },
    { name: "Applications", view: "applications", roles: ["tenant", "landlord"] as const, icon: <FaTags /> },
    { name: "Payments", view: "payments", roles: ["tenant", "landlord"] as const, icon: <FaCreditCard /> },
  ];

  if (loadingUser) return <div className="h-screen grid place-items-center text-slate-600">Loading rent dashboard…</div>;
  if (!user) return <div className="h-screen grid place-items-center text-slate-600">Not signed in.</div>;

  return (
    <Fragment>
      <div className="h-screen flex flex-col bg-slate-50 text-[#202124]">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 flex-shrink-0 bg-white p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => navigate("/")} className="text-2xl font-bold">Rent Dashboard</button>
              <button
                onClick={() => (auth.currentUser ? signOut(auth) : (window.location.href = "/login"))}
                className="px-3 py-2 rounded-lg bg-[#FF6D4D] text-white text-sm font-semibold hover:bg-[#e85f41]"
              >
                {auth.currentUser ? "Sign out" : "Sign in"}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {sidebar
                .filter((s) => (s.roles as readonly string[]).includes(activeRole))
                .map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setActiveView(s.view as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-colors ${activeView === s.view ? "bg-[#FF6D4D] text-white shadow-lg" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span>{s.name}</span>
                  </button>
                ))}

              {user.roles.includes("tenant") && user.roles.includes("landlord") && (
                <div className="mt-4 p-1 bg-slate-200 rounded-xl flex items-center gap-1">
                  {(["landlord", "tenant"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setActiveRole(r)}
                      className={`px-4 py-2 text-sm font-semibold capitalize rounded-lg transition-colors ${activeRole === r ? "bg-white shadow" : "text-slate-600 hover:bg-white/50"
                        }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 overflow-y-auto">
            <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
              <header className="flex flex-col sm:flex-row items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                <div className="mt-4 sm:mt-0 text-sm text-slate-500 capitalize">Role: {activeRole}</div>
              </header>

              <StatsBar offers={offersCount} escrows={escrowsCount} />

              {activeView === "rentals" && activeRole === "landlord" && (
                <LandlordRentListings listings={listings} onNewApp={handleCreateMockApplication} />
              )}

              {activeView === "applications" && (
                <ApplicationsTable
                  apps={apps}
                  role={activeRole}
                  onOpenTimeline={(a) => setSelectedApp(a)}
                  onAcceptDeposit={handleAcceptDeposit}
                />
              )}

              {activeView === "payments" && <Payments />}
            </main>
          </div>
        </div>
      </div>

      {/* Timeline Modal */}
      <ApplicationTimelineModal
        app={selectedApp}
        onClose={() => setSelectedApp(null)}
        onDoIdVerify={handleDoIdVerify}
        onUploadTaxes={handleUploadTaxes}
      />
    </Fragment>
  );
};

export default RentDashboard;
