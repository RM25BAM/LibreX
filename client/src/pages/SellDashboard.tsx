import React, { useState, Fragment, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaWallet, FaCopy, FaEthereum, FaPlusCircle, FaTimes,
  FaCheckCircle, FaHourglassHalf, FaCircle, FaBuilding, FaTags, FaCreditCard, FaTrash
} from 'react-icons/fa';
import { getXrpBalance } from "../lib/xrplClient";
import { connectCrossmark, payWithCrossmark } from "../lib/crossmark";
import Logo from "/logo.svg";
import MetaFox from "../assets/metafox.png"
import CrossMark from "../assets/crossmark.png"
import { onAuthStateChanged, setPersistence, browserLocalPersistence, signOut } from "firebase/auth";
import { auth, storage } from "../../firebase";
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

import { ethers } from "ethers";
import EscrowAbi from "../contracts/Escrow.json";
import SimpleIdvDialog from "../components/SimpleIdvDialog";

const db = getFirestore();

declare global {
  interface Window {
    ethereum?: any;
  }
}

// XRPL EVM chain params that MetaMask expects -> chainId hex
const XRPL_EVM_PARAMS = {
  chainId: "0x161c28", // 1449000
  chainName: "XRPL EVM Testnet",
  rpcUrls: ["https://rpc.testnet.xrplevm.org"],
  nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 18 },
  blockExplorerUrls: ["https://explorer.testnet.xrplevm.org"],
};

const API_BASE = import.meta.env.VITE_API_BASE || "";

// Switch if added - > add if missing -> then return signer
async function getSignerXRPL() {
  if (!window.ethereum) throw new Error("MetaMask not found");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: XRPL_EVM_PARAMS.chainId }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [XRPL_EVM_PARAMS],
      });
    } else {
      throw err;
    }
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(window.ethereum);
  return provider.getSigner();
}


interface AppUser {
  uid: string;
  email: string;
  username: string;
  roles: Array<"buyer" | "seller" | "tenant" | "landlord" | "buyer_seller">;
  activeRole: "buyer" | "seller" | "tenant" | "landlord" | "buyer_seller";
  xrplAddress?: string;
  evmAddress?: string;
  walletType?: "email" | "metamask" | "CrossMark" | "crossmark" | "dynamyx";
}

type ListingType = "sale" | "rent";
type ListingStatus = "active" | "paused" | "closed" | "draft";

export type PropertyDoc = {
  id: string;
  ownerUid: string;
  type: ListingType;
  priceOrRent: number;
  address: string;
  status: Exclude<ListingStatus, "draft">;
  imageUrls?: string[];
  bed: number;
  bath: number;
  details: string;
  lat?: number;
  lng?: number;
};

export type OfferState =
  | "OFFER_SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "ESCROW_CREATED"
  | "COMPLETED";

export type OfferDoc = {
  id: string;
  amount: number;
  currency: string;
  buyerUid: string;
  sellerUid: string;
  propertyId: string;
  createdAt?: any;
  state: OfferState;
  escrowAddress?: string;

  // Escrow status + error for timeline
  escrowStatus?: "idle" | "creating" | "created" | "error";
  escrowError?: string | null;

  idvStatus?: "not_started" | "pending" | "verified" | "failed";
  docStatus?: "pending" | "in_review" | "approved";
};

type EscrowState = "AWAITING_DEPOSIT" | "FUNDED" | "DOCS_PENDING" | "READY_TO_RELEASE" | "RELEASED";
type MilestoneState = "pending" | "passed" | "rejected";

const formatMoney = (amt: number, currency = "USD") =>
  (amt ?? 0).toLocaleString("en-US", { style: "currency", currency });

/* ui parts */
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white shadow-sm rounded-xl ${className}`}>{children}</div>
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
  children, variant = "primary", className = "", onClick, type = "button", disabled,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`px-4 h-10 text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${variant === "primary"
      ? "bg-[#FF6D4D] text-white hover:bg-[#e85f41]"
      : variant === 'danger'
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

const Identicon = ({ address }: { address: string }) => {
  const seed = parseInt((address?.slice(2, 10) || "abcd1234"), 16);
  const colors = ['#FF6D4D', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const R = (s: number) => (s = Math.sin(s) * 10000) - Math.floor(s);
  const C = (i: number) => colors[Math.floor(R(seed + i) * colors.length)];
  return (
    <svg viewBox="0 0 100 100" className="w-12 h-12 rounded-full">
      <rect width="100" height="100" fill={C(0)} />
      <rect x="25" y="25" width="50" height="50" fill={C(1)} transform={`rotate(${R(seed) * 90} 50 50)`} />
      <circle cx="50" cy="50" r="15" fill={C(2)} />
    </svg>
  );
};

const GlassWalletCard = ({ address, balance, network }: { address: string; balance: string | number; network: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    className="relative w-full max-w-lg mx-auto rounded-lg p-6 text-slate-900 overflow-hidden bg-slate-800/60 backdrop-blur-xl border border-white/20 shadow-2xl"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <FaEthereum className="text-slate-200" />
        <span className="text-sm font-medium text-slate-100">{network}</span>
      </div>
      <Badge className="bg-white/20 text-white">Connected</Badge>
    </div>

    <div className="flex items-center gap-4 mt-8">
      <Identicon address={address} />
      <div>
        <p className="text-sm text-white/80">Wallet Address</p>
        <p className="text-lg font-mono break-all text-white">{address}</p>
      </div>
    </div>

    <div className="mt-8">
      <p className="text-sm text-white/80">Total Balance</p>
      <p className="text-4xl font-bold tracking-tight text-white">{balance} XRP</p>
    </div>

    <Button
      variant="secondary"
      className="w-full mt-6 !bg-white/10 !border-white/20 !text-white hover:!bg-white/20"
      onClick={() => navigator.clipboard.writeText(address || "").catch(() => { })}
    >
      <FaCopy /> Copy Address
    </Button>
  </motion.div>
);

// Variant with MetaMask styling
const GlassWalletCardMetaMask = ({ address, balance, onDisconnect }: { address: string; balance: string | number; onDisconnect?: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    className="relative w-full max-w-lg mx-auto rounded-lg p-6 text-slate-900 overflow-hidden bg-gradient-to-br from-amber-500/20 to-rose-500/10 backdrop-blur-xl border border-white/20 shadow-2xl"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src={MetaFox} alt="MetaMask" className="w-5 h-5" />
        <span className="text-sm font-medium text-slate-800">XRPL EVM Testnet</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-green-100 text-green-800">Connected</Badge>
        {onDisconnect ? (
          <Button variant="secondary" size="sm" className="!bg-red-600 !text-white hover:!bg-red-700 !border-transparent" onClick={onDisconnect}>Disconnect</Button>
        ) : null}
      </div>
    </div>

    <div className="flex items-center gap-4 mt-8">
      <Identicon address={address} />
      <div>
        <p className="text-sm text-slate-600">Wallet Address</p>
        <p className="text-lg font-mono break-all text-slate-900">{address}</p>
      </div>
    </div>

    <div className="mt-8">
      <p className="text-sm text-slate-600">Total Balance</p>
      <p className="text-4xl font-bold tracking-tight text-slate-900">{balance} XRP</p>
      <p className="text-xs text-slate-600 mt-1">Native token on XRPL EVM</p>
    </div>

    <Button
      variant="secondary"
      className="w-full mt-6 !bg-white !border-slate-300 !text-slate-800 hover:!bg-slate-100"
      onClick={() => navigator.clipboard.writeText(address || "").catch(() => { })}
    >
      <FaCopy /> Copy Address
    </Button>
  </motion.div>
);

// Variant with Crossmark/XRPL styling
const GlassWalletCardCrossmark = ({ address, balance, onDisconnect }: { address: string; balance: string | number; onDisconnect?: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    className="relative w-full max-w-lg mx-auto rounded-lg p-6 text-slate-900 overflow-hidden bg-gradient-to-br from-blue-500/20 to-cyan-500/10 backdrop-blur-xl border border-white/20 shadow-2xl"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src={CrossMark} alt="Crossmark" className="w-5 h-5" />
        <span className="text-sm font-medium text-slate-800">XRPL Testnet (L1)</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-blue-100 text-blue-800">Connected</Badge>
        {onDisconnect ? (
          <Button variant="secondary" size="sm" className="!bg-red-600 !text-white hover:!bg-red-700 !border-transparent" onClick={onDisconnect}>Disconnect</Button>
        ) : null}
      </div>
    </div>

    <div className="flex items-center gap-4 mt-8">
      <Identicon address={address} />
      <div>
        <p className="text-sm text-slate-600">Wallet Address</p>
        <p className="text-lg font-mono break-all text-slate-900">{address}</p>
      </div>
    </div>

    <div className="mt-8">
      <p className="text-sm text-slate-600">Total Balance</p>
      <p className="text-4xl font-bold tracking-tight text-slate-900">{balance} XRP</p>
      <p className="text-xs text-slate-600 mt-1">Native token on XRPL</p>
    </div>

    <Button
      variant="secondary"
      className="w-full mt-6 !bg-white !border-slate-300 !text-slate-800 hover:!bg-slate-100"
      onClick={() => navigator.clipboard.writeText(address || "").catch(() => { })}
    >
      <FaCopy /> Copy Address
    </Button>
  </motion.div>
);

const TableLike = ({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>{columns.map(c => <th key={c} className="p-3 text-left font-semibold text-slate-600">{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-slate-50">
            {row.map((cell, j) => <td key={j} className="p-3 text-slate-700 truncate">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* stats card */
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

const StatsBar = ({ applications, escrows }: { applications: number; escrows: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard label="Active Applications" value={applications} icon={<FaTags />} />
    <StatCard label="Open Escrows" value={escrows} icon={<FaWallet />} />
    <StatCard label="Approved Tenants" value={<span className="text-green-600">—</span>} icon={<FaCheckCircle />} />
    <StatCard label="Pending Verifications" value={<span>—</span>} icon={<FaHourglassHalf />} />
  </div>
);

interface OfferTimelineType extends OfferDoc {
  propertyAddress?: string;
}

const StepIcon = ({ state }: { state: "pending" | "inprogress" | "complete" }) => {
  if (state === "complete") return <FaCheckCircle className="text-green-500" />;
  if (state === "inprogress") return <FaHourglassHalf className="text-blue-500 animate-spin" />;
  return <FaCircle className="text-slate-300" />;
};

const OfferTimelineModal = ({
  offer,
  role,
  buyerEvmAddress,
  onClose,
  onStartVerifyId,
  onStartCreateEscrow,
}: {
  offer: OfferTimelineType | null;
  role: "buyer" | "seller";
  buyerEvmAddress?: string;
  onClose: () => void;
  onStartVerifyId: (offer: OfferTimelineType) => Promise<void>;
  onStartCreateEscrow: (offer: OfferTimelineType) => Promise<void>;
}) => {
  const [liveOffer, setLiveOffer] = useState<OfferTimelineType | null>(offer);
  const [docBusy, setDocBusy] = useState(false);
  const [docMessage, setDocMessage] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<string | null>(offer?.docStatus ?? null);

  useEffect(() => {
    if (!offer) {
      setLiveOffer(null);
      setDocStatus(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "offers", offer.id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...(snap.data() as any) } as OfferTimelineType;
        setLiveOffer(data);
        // keep local docStatus in sync with Firestore
        setDocStatus((data as any)?.docStatus ?? null);
      }
    });
    return () => unsub();
  }, [offer?.id]);

  if (!offer) return null;

  const o = liveOffer ?? offer;

  // helpers for document upload (no hooks inside ⇒ order is safe)
  async function pollDocStatus(offerId: string, tries = 10) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(`${API_BASE}/api/documents/status?offerId=${offerId}`);
        if (res.ok) {
          const data = await res.json();
          setDocStatus(data.status);
          if (data.status !== "in_review" && data.status !== "pending") break;
        }
      } catch { /* ignore */ }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  async function uploadDoc(kind: string, file: File) {
    const fd = new FormData();
    fd.append("offerId", o.id);
    fd.append("kind", kind);
    fd.append("file", file);

    setDocBusy(true);
    setDocMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/documents/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setDocMessage(`Uploaded. Status: ${data.status}${data.reason ? ` (${data.reason})` : ""}`);
      setDocStatus(data.status);
      if (data.status === "in_review") pollDocStatus(o.id);
    } catch (e: any) {
      setDocMessage(e?.message || "Upload failed");
    } finally {
      setDocBusy(false);
    }
  }

  const walletConnected = !!buyerEvmAddress;
  const escrowCreated = !!o?.escrowAddress || o?.escrowStatus === "created";
  const escrowCreating = o?.escrowStatus === "creating";
  const escrowErrored = o?.escrowStatus === "error";
  const escrowErrorMsg = (o as any)?.escrowError || null;

  const escrowStepState: "pending" | "inprogress" | "complete" =
    escrowCreated ? "complete" : escrowCreating ? "inprogress" : "pending";

  const idvStatusEff = o?.idvStatus as ("not_started" | "pending" | "verified" | "failed" | undefined);
  const idvStepState: "pending" | "inprogress" | "complete" =
    idvStatusEff === "verified" ? "complete"
      : idvStatusEff === "pending" ? "inprogress"
        : "pending";


  const docStatusEff = (docStatus ?? o?.docStatus) as ("pending" | "in_review" | "approved" | "rejected" | undefined);
  const documentStepState: "pending" | "inprogress" | "complete" =
    docStatusEff === "approved" ? "complete"
      : (docStatusEff === "pending" || docStatusEff === "in_review") ? "inprogress"
        : "pending";
  return (
    <AnimatePresence>
      <motion.div
        key={o.id}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl"
        >
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction Timeline</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Offer for {offer.propertyAddress || `#${o.propertyId}`} • {formatMoney(o.amount, o.currency)}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-slate-100">
              <FaTimes />
            </button>
          </CardHeader>

          <CardContent className="py-8">
            <div className="relative pl-8">
              <div className="absolute left-4 top-2 h-full w-0.5 bg-slate-200" />
              <div className="space-y-8">
                {/* Escrow part */}
                <div className="relative flex items-start gap-4">
                  <div className="absolute left-[-2px] top-1 h-8 w-8 bg-white rounded-full flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                      <StepIcon state={escrowStepState} />
                    </div>
                  </div>
                  <div className="ml-8">
                    <p className="font-semibold text-slate-800">Escrow</p>
                    <p className="text-sm text-slate-500">
                      {!walletConnected
                        ? "Wallet not connected."
                        : escrowCreated
                          ? `Escrow created${o?.escrowAddress ? ` at ${o.escrowAddress}` : ""}.`
                          : escrowCreating
                            ? "Creating escrow…"
                            : escrowErrored
                              ? "Escrow creation failed."
                              : "Click below to create escrow to proceed."}
                    </p>

                    {escrowErrored && (
                      <div className="mt-2 text-xs text-red-600">
                        {escrowErrorMsg || "Unknown error."}
                      </div>
                    )}

                    {role === "buyer" && walletConnected && !escrowCreated && (
                      <div className="mt-3">
                        <Button
                          variant="primary"
                          disabled={escrowCreating}
                          onClick={() => onStartCreateEscrow(o)}
                        >
                          {escrowCreating ? "Creating…" : escrowErrored ? "Retry Create Escrow" : "Create Escrow"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ID Verification */}
                <div className="relative flex items-start gap-4">
                  <div className="absolute left-[-2px] top-1 h-8 w-8 bg-white rounded-full flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                      <StepIcon state={idvStepState} />
                    </div>
                  </div>
                  <div className="ml-8">
                    <p className="font-semibold text-slate-800">Identity Verification</p>
                    <p className="text-sm text-slate-500">
                      {idvStepState !== "complete"
                        ? "Blocked until ID is verified."
                        : documentStepState === "complete"
                          ? "Documents approved."
                          : documentStepState === "inprogress"
                            ? "Documents are under review."
                            : "Waiting for documents."}
                    </p>
                    {role === "buyer" && !escrowCreated && (
                      <p className="text-xs text-amber-600 mt-2">Escrow must be created before verifying ID.</p>
                    )}
                    {role === "buyer" && escrowCreated && idvStepState !== "complete" && (
                      <div className="mt-3">
                        <Button
                          variant="primary"
                          disabled={idvStepState === "inprogress"}
                          onClick={() => onStartVerifyId(o)}
                        >
                          {idvStepState === "inprogress" ? "Opening…" : "Verify with Shopify"}
                        </Button>
                      </div>
                    )}

                    {/* Doc upload UI (always rendered — no hooks here) */}
                    {idvStepState === "complete" && (
                      <div className="mt-3 space-y-2">
                        <div className="text-sm text-slate-600">
                          Upload a document (PDF/JPG/PNG). The demo backend auto-checker approves
                          if it finds "pre-approval" or enough text; rejects if it finds "denied".
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="doc-file"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadDoc("preApproval", f);
                              e.currentTarget.value = "";
                            }}
                          />
                          <Button variant="secondary" disabled={docBusy}>
                            {docBusy ? "Uploading..." : "Upload"}
                          </Button>
                        </div>
                        {docMessage && <div className="text-xs text-slate-600">{docMessage}</div>}
                        {docStatus && (
                          <div className="text-sm">
                            Current status:{" "}
                            <Badge className={
                              docStatus === "approved" ? "bg-green-100 text-green-800" :
                                docStatus === "rejected" ? "bg-red-100 text-red-800" :
                                  "bg-amber-100 text-amber-800"
                            }>
                              {docStatus}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Document Check */}
                <div className="relative flex items-start gap-4">
                  <div className="absolute left-[-2px] top-1 h-8 w-8 bg-white rounded-full flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                      <StepIcon state={documentStepState} />
                    </div>
                  </div>
                  <div className="ml-8">
                    <p className="font-semibold text-slate-800">Document Check</p>
                    <p className="text-sm text-slate-500">
                      {idvStepState !== "complete"
                        ? "Blocked until ID is verified."
                        : documentStepState === "complete"
                          ? "Documents approved."
                          : documentStepState === "inprogress"
                            ? "Documents are under review."
                            : "Waiting for documents."}
                    </p>
                  </div>
                </div>

                {/*  Final Approval */}
                <div className="relative flex items-start gap-4">
                  <div className="absolute left-[-2px] top-1 h-8 w-8 bg-white rounded-full flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                      <StepIcon state={documentStepState === "complete" ? "inprogress" : "pending"} />
                    </div>
                  </div>
                  <div className="ml-8">
                    <p className="font-semibold text-slate-800">Final Approval</p>
                    <p className="text-sm text-slate-500">
                      {documentStepState === "complete" ? "Pending final review and signatures." : "Waiting on documents."}
                    </p>
                  </div>
                </div>

                {/*  Funds Released */}
                <div className="relative flex items-start gap-4">
                  <div className="absolute left-[-2px] top-1 h-8 w-8 bg-white rounded-full flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                      <StepIcon state={"pending"} />
                    </div>
                  </div>
                  <div className="ml-8">
                    <p className="font-semibold text-slate-800">Funds Released</p>
                    <p className="text-sm text-slate-500">Transaction complete and funds released.</p>
                  </div>
                </div>

              </div>
            </div>
          </CardContent>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* create listing either rent/sale */
const MAX_IMAGES = 10;

const CreateListingModal = ({
  isOpen, onClose, onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: {
    address: string;
    type: ListingType;
    priceOrRent: number | "";
    status: ListingStatus;
    images: File[];
    bed: number | "";
    bath: number | "";
    details: string;
  }) => void;
}) => {
  const [address, setAddress] = useState("");
  const [type, setType] = useState<ListingType>("sale");
  const [priceOrRent, setPriceOrRent] = useState<string>("");
  const [status, setStatus] = useState<ListingStatus>("draft");
  const [bed, setBed] = useState<string>("");
  const [bath, setBath] = useState<string>("");
  const [images, setImages] = useState<File[]>([]);
  const [details, setDetails] = useState("");

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const next = [...images, ...arr].slice(0, MAX_IMAGES);
    setImages(next);
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleCreate = () => {
    onSubmit?.({
      address: address.trim(),
      type,
      priceOrRent: priceOrRent === "" ? "" : Number(priceOrRent),
      status,
      images,
      bed: bed === "" ? "" : Number(bed),
      bath: bath === "" ? "" : Number(bath),
      details: details.trim(),
    });
    onClose();
    setTimeout(() => {
      setAddress("");
      setType("sale");
      setPriceOrRent("");
      setStatus("draft");
      setImages([]);
      setDetails("");
      setBed("");
      setBath("");
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        >
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Create New Listing</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Fill in your property details and add photos.</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-slate-100"><FaTimes /></button>
          </CardHeader>

          <CardContent className="py-6 px-4 sm:px-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-slate-700">Property Address</label>
              <input
                type="text"
                className="mt-1 block w-full border border-slate-300 rounded-lg p-2"
                placeholder="123 Main St, City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Type</label>
                <select
                  className="mt-1 block w-full border border-slate-300 rounded-lg p-2"
                  value={type}
                  onChange={(e) => setType(e.target.value as ListingType)}
                >
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Price / Rent Amount (USD)</label>
                <input
                  type="number"
                  className="mt-1 block w-full border border-slate-300 rounded-lg p-2"
                  placeholder="Enter amount"
                  value={priceOrRent}
                  onChange={(e) => setPriceOrRent(e.target.value)}
                  min={0}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Bedrooms</label>
                <input
                  type="number" min={0} step={1} inputMode="numeric"
                  className="mt-1 block w-full border border-slate-300 rounded-lg p-2"
                  placeholder="e.g., 3"
                  value={bed}
                  onChange={(e) => { const v = e.target.value; if (v === "" || (/^\d+$/.test(v) && Number(v) >= 0)) setBed(v); }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Bathrooms</label>
                <input
                  type="number" min={0} step={1} inputMode="numeric"
                  className="mt-1 block w-full border border-slate-300 rounded-lg p-2"
                  placeholder="e.g., 2"
                  value={bath}
                  onChange={(e) => { const v = e.target.value; if (v === "" || (/^\d+$/.test(v) && Number(v) >= 0)) setBath(v); }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                className="mt-1 block w-full border border-slate-300 rounded-lg p-2"
                value={status}
                onChange={(e) => setStatus(e.target.value as ListingStatus)}
              >
                <option value="draft">Draft (local)</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">Only Active/Paused/Closed are saved to Firestore.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Details</label>
              <textarea
                className="mt-1 block w-full border border-slate-300 rounded-lg p-2"
                placeholder="House details (features, notes, etc.)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Photos</label>
              <div
                className="mt-1 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-slate-400"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
              >
                <input id="file-input" type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />
                <label htmlFor="file-input" className="block cursor-pointer">
                  <div className="text-slate-600">
                    Drag & drop images here or <span className="text-[#FF6D4D] font-semibold">browse</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Up to {MAX_IMAGES} images. PNG/JPG/WebP.</div>
                </label>
              </div>
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {images.map((file, idx) => (
                    <div key={idx} className="relative group">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-28 object-cover rounded-lg border" />
                      <Button
                        variant="danger"
                        className="absolute top-2 right-2 !h-8 !px-2 opacity-90 group-hover:opacity-100"
                        onClick={() => removeImage(idx)}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>

          <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}><FaPlusCircle /> Create Listing</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* listings table */
const SellerListings = ({ listings }: { listings: PropertyDoc[] }) => (
  <Card>
    <CardHeader><CardTitle>My Listings</CardTitle></CardHeader>
    <CardContent>
      <TableLike
        columns={["Property", "Type", "Price", "Beds", "Baths", "Status", "Photos"]}
        rows={listings.map(l => [
          l.address,
          l.type === 'sale' ? 'Sale' : 'Rent',
          l.priceOrRent?.toLocaleString?.('en-US', { style: 'currency', currency: 'USD' }) ?? '-',
          l.bed ?? 0,
          l.bath ?? 0,
          l.status === 'active' ? <Badge className="bg-green-100 text-green-800">Active</Badge>
            : l.status === 'paused' ? <Badge className="bg-amber-100 text-amber-800">Paused</Badge>
              : <Badge className="bg-slate-100 text-slate-800">Closed</Badge>,
          <div className="flex -space-x-2">
            {(l.imageUrls || []).slice(0, 4).map((u, i) => (
              <img key={i} src={u} alt="" className="w-8 h-8 rounded-full border object-cover" />
            ))}
            {(l.imageUrls?.length || 0) > 4 && (
              <Badge className="bg-slate-100 text-slate-700 ml-2">+{(l.imageUrls!.length - 4)}</Badge>
            )}
          </div>
        ])}
      />
    </CardContent>
  </Card>
);

async function fetchPropertyAddress(propertyId: string) {
  try {
    const ref = doc(db, "properties", propertyId);
    const snap = await getDoc(ref);
    return snap.exists() ? ((snap.data() as any).address || `#${propertyId}`) : `#${propertyId}`;
  } catch {
    return `#${propertyId}`;
  }
}

const OffersTable = ({
  role,
  offers,
  onAccept,
  onReject,
  onView,
}: {
  role: "buyer" | "seller";
  offers: (OfferDoc & { propertyAddress?: string })[];
  onAccept: (o: OfferDoc) => void;
  onReject: (o: OfferDoc) => void;
  onView: (o: OfferDoc & { propertyAddress?: string }) => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{role === "seller" ? "Incoming Offers" : "My Offers"}</CardTitle>
    </CardHeader>
    <CardContent>
      <TableLike

        columns={["Property", "Amount", role === "seller" ? "Buyer" : "Seller", "State", "Action"]}
        rows={
          offers.length === 0
            ? [[<span key="no-offers" className="text-slate-500">No offers yet.</span>, "", "", "", ""]]
            : offers.map((o) => [
              o.propertyAddress || `#${o.propertyId}`,
              formatMoney(o.amount, o.currency),

              role === "seller" ? o.buyerUid : o.sellerUid,
              <Badge
                key={`state-${o.id}`}
                className={`capitalize ${o.state === "ACCEPTED"
                  ? "bg-green-100 text-green-800"
                  : o.state === "REJECTED"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-100 text-slate-800"
                  }`}
              >
                {o.state.replace(/_/g, " ").toLowerCase()}
              </Badge>,
              <div key={`actions-${o.id}`} className="flex flex-wrap gap-2">
                {role === 'seller' && o.state === 'OFFER_SENT' ? (
                  <>
                    <Button variant="primary" onClick={() => onAccept(o)}>Accept</Button>
                    <Button variant="secondary" onClick={() => onReject(o)}>Reject</Button>
                  </>
                ) : null}
                {(role === 'buyer' || (role === 'seller' && o.state !== 'OFFER_SENT')) && (
                  <Button variant="secondary" onClick={() => onView(o)}>View</Button>
                )}
              </div>,
            ])
        }
      />
    </CardContent>
  </Card>
);

async function fetchUserByUid(uid: string): Promise<AppUser> {
  const userDocRef = doc(db, 'users', uid);
  const snap = await getDoc(userDocRef);
  if (!snap.exists()) throw new Error('User profile not found in Firestore.');
  const data = snap.data() as any;
  return {
    uid,
    email: data.email || '',
    username: data.username || '',
    roles: (data.roles || []) as AppUser['roles'],
    activeRole: (data.activeRole || 'buyer') as AppUser['activeRole'],
    xrplAddress: data.xrplAddress,
    evmAddress: data.evmAddress,
    walletType: data.walletType,
  };
}

async function fetchMyProperties(ownerUid: string): Promise<PropertyDoc[]> {
  const qy = query(collection(db, 'properties'), where('ownerUid', '==', ownerUid));
  const snapshot = await getDocs(qy);
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PropertyDoc, 'id'>) }));
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const key = import.meta.env.VITE_APP_Maps_API_KEY;
    if (!key || !address) return null;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') return { lat: loc.lat, lng: loc.lng };
    return null;
  } catch {
    return null;
  }
}

async function createPropertyDocument({
  ownerUid,
  address,
  type,
  priceOrRent,
  status,
  images,
  bed,
  bath,
  details,
}: {
  ownerUid: string;
  address: string;
  type: ListingType;
  priceOrRent: number;
  status: Exclude<ListingStatus, 'draft'>;
  images: File[];
  bed: number;
  bath: number;
  details: string;
}): Promise<PropertyDoc> {
  const propRef = doc(collection(db, 'properties'));
  const propId = propRef.id;

  const geocodePromise = geocodeAddress(address);

  const basePayload: Omit<PropertyDoc, 'id'> = {
    ownerUid, type, priceOrRent, address, status, imageUrls: [], bed, bath, details: details || "",
  };
  await setDoc(propRef, basePayload);

  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const safeName = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const imgRef = storageRef(storage, `properties/${propId}/images/${safeName}`);
    await uploadBytes(imgRef, file);
    const url = await getDownloadURL(imgRef);
    urls.push(url);
  }
  if (urls.length) await updateDoc(propRef, { imageUrls: urls });

  const loc = await geocodePromise;
  if (loc) await updateDoc(propRef, { lat: loc.lat, lng: loc.lng });

  return { id: propId, ...basePayload, imageUrls: urls, ...(loc ?? {}) };
}

async function initEscrowDoc(
  escrowId: string,
  data: {
    offerId: string;
    buyerAddressEvm: string;
    sellerAddressEvm: string;
    amountWei: bigint;
    deadline: number;
    escrowAddress: string;
  }
) {
  const ref = doc(db, "escrows", escrowId);
  await setDoc(ref, {
    offerId: data.offerId,
    buyerAddressEvm: data.buyerAddressEvm,
    sellerAddressEvm: data.sellerAddressEvm,
    amountWei: data.amountWei.toString(),
    deadline: data.deadline,
    state: "AWAITING_DEPOSIT" as EscrowState,
    documents: {
      preApproval: { url: null, status: "pending" as MilestoneState, fields: null, confidence: null },
      inspection: { url: null, status: "pending" as MilestoneState, fields: null, confidence: null },
    },
    milestones: { preApproval: "pending", inspection: "pending" },
    escrowAddress: data.escrowAddress,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/* offers view (realtime) */
const OffersView = ({ activeRole, onViewOffer }: { activeRole: 'buyer' | 'seller'; onViewOffer: (offer: OfferTimelineType) => void; }) => {
  const [offers, setOffers] = useState<(OfferDoc & { propertyAddress?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const field = activeRole === "seller" ? "sellerUid" : "buyerUid";
    const qy = query(collection(db, "offers"), where(field, "==", u.uid));

    const unsub = onSnapshot(qy, async (snap) => {
      try {
        const raw: OfferDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const enriched = await Promise.all(
          raw.map(async (o) => ({
            ...o,
            propertyAddress: await fetchPropertyAddress(o.propertyId),
          }))
        );
        setOffers(enriched);
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || "Failed to load offers");
        setLoading(false);
      }
    }, (e) => {
      setErr(e?.message || "Failed to load offers");
      setLoading(false);
    });

    return () => unsub();
  }, [activeRole]);

  const acceptOffer = async (o: OfferDoc) => {
    await updateDoc(doc(db, "offers", o.id), { state: "ACCEPTED" as OfferState });
  };
  const rejectOffer = async (o: OfferDoc) => {
    await updateDoc(doc(db, "offers", o.id), { state: "REJECTED" as OfferState });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Offers</h2>
        <div className="p-6 text-slate-500">Loading offers…</div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Offers</h2>
        <div className="p-6 text-red-600">{err}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Offers</h2>
      <OffersTable
        role={activeRole}
        offers={offers}
        onAccept={acceptOffer}
        onReject={rejectOffer}
        onView={(o) => onViewOffer(o)}
      />
    </div>
  );
};


const PropertiesView = ({ activeRole, ownerUid }: { activeRole: 'buyer' | 'seller'; ownerUid: string }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [listings, setListings] = useState<PropertyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchMyProperties(ownerUid);
      setListings(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (ownerUid) load(); }, [ownerUid]);

  const handleCreate = async (form: {
    address: string; type: ListingType; priceOrRent: number | ""; status: ListingStatus;
    images: File[]; bed: number | ""; bath: number | ""; details: string;
  }) => {
    if (!ownerUid) return;
    try {
      const priceNum = Number(form.priceOrRent) || 0;
      const bedNum = typeof form.bed === "number" ? form.bed : Number(form.bed) || 0;
      const bathNum = typeof form.bath === "number" ? form.bath : Number(form.bath) || 0;

      const persistedStatus: Exclude<ListingStatus, 'draft'> =
        ['active', 'paused', 'closed'].includes(form.status) ? (form.status as any) : 'active';

      const created = await createPropertyDocument({
        ownerUid, address: form.address, type: form.type, priceOrRent: priceNum,
        status: persistedStatus, images: form.images, bed: bedNum, bath: bathNum, details: form.details,
      });
      setListings(prev => [created, ...prev]);
    } catch (e) {
      console.error(e);
      alert('Failed to create property. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">My Properties</h2>
        {activeRole === 'seller' && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <FaPlusCircle /> Create New Listing
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-6 text-slate-500">Loading listings…</div>
      ) : error ? (
        <div className="p-6 text-red-600">{error}</div>
      ) : (
        <SellerListings listings={listings} />
      )}

      <CreateListingModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
};

const PaymentsView = ({
  evmAddress,
  onConnectMetaMask,
  onConnectXRPL,
  onDisconnectWallet,
  onSwitchWallet,
  xrplAddress,
  xrplBalance,
  xrplBusy,
  onSendTestXrp,
}: {
  evmAddress?: string;
  onConnectMetaMask: () => Promise<void>;
  onConnectXRPL: () => Promise<void>;
  onDisconnectWallet: () => Promise<void>;
  onSwitchWallet: (walletType: 'metamask' | 'crossmark') => Promise<void>;
  xrplAddress?: string;
  xrplBalance?: string;
  xrplBusy?: boolean;
  onSendTestXrp?: () => Promise<void> | void;
}) => (
  <div className="space-y-8">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-slate-800">Payments & Wallets</h2>
      <p className="text-slate-500 mt-1">Connect one crypto wallet to manage payments and transactions.</p>
      <p className="text-xs text-slate-400 mt-2">Note: You can only be connected to one wallet at a time</p>
    </div>

    {/* Current Wallet Status - Glass Cards */}
    {evmAddress ? (
      <GlassWalletCardMetaMask address={evmAddress} balance="—" onDisconnect={onDisconnectWallet} />
    ) : xrplAddress ? (
      <GlassWalletCardCrossmark address={xrplAddress} balance={xrplBalance ?? "—"} onDisconnect={onDisconnectWallet} />
    ) : null}

    {/* Wallet Connection Options */}
    <Card>
      <CardHeader>
        <CardTitle>Connect Wallet</CardTitle>
        <p className="text-sm text-slate-600">Choose one wallet type to connect</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!evmAddress && !xrplAddress ? (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <FaWallet className="text-amber-600" />
              <span className="font-semibold text-amber-800">No Wallet Connected</span>
            </div>
            <p className="text-sm text-amber-700">You need to connect a crypto wallet to manage payments and transactions.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            variant="secondary"
            className="!justify-start h-auto p-4"
            onClick={evmAddress ? () => onSwitchWallet('metamask') : onConnectMetaMask}
            disabled={!!xrplAddress}
          >
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center gap-2 mb-2">
                <img src={MetaFox} alt="MetaMask" className="w-6 h-6" />
                <span className="font-semibold">MetaMask (EVM)</span>
              </div>
              <span className="text-xs text-slate-500">XRPL EVM Testnet</span>
              {evmAddress && <span className="text-xs text-green-600 mt-1">✓ Connected</span>}
              {!evmAddress && xrplAddress && <span className="text-xs text-blue-600 mt-1">Switch to this wallet</span>}
            </div>
          </Button>

          <Button
            variant="secondary"
            className="!justify-start h-auto p-4"
            onClick={xrplAddress ? () => onSwitchWallet('crossmark') : onConnectXRPL}
            disabled={!!evmAddress}
          >
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center gap-2 mb-2">
                <img src={CrossMark} alt="Crossmark" className="w-6 h-6" />
                <span className="font-semibold">Crossmark (XRPL)</span>
              </div>
              <span className="text-xs text-slate-500">XRPL Testnet (L1)</span>
              {xrplAddress && <span className="text-xs text-green-600 mt-1">✓ Connected</span>}
              {!xrplAddress && evmAddress && <span className="text-xs text-blue-600 mt-1">Switch to this wallet</span>}
            </div>
          </Button>
        </div>

        {/* XRPL Test Features */}
        {xrplAddress && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
            <h4 className="font-semibold text-slate-800 mb-3">XRPL Test Features</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600">Balance</div>
                  <div className="text-lg font-semibold">{xrplBalance ?? "—"} XRP</div>
                </div>
                <Button variant="primary" disabled={!!xrplBusy} onClick={onSendTestXrp}>
                  {xrplBusy ? "Submitting…" : "Send Test XRP"}
                </Button>
              </div>
              <div className="text-xs text-slate-500">
                Uses Crossmark to sign a 1-drop test payment on XRPL Testnet and logs it in Firestore.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);

const SellDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [xrplAddress, setXrplAddress] = useState<string | undefined>(undefined);
  const [xrplBalance, setXrplBalance] = useState<string | undefined>(undefined);
  const [xrplBusy, setXrplBusy] = useState(false);
  const [activeView, setActiveView] = useState<'properties' | 'offers' | 'payments'>('properties');
  const [activeRole, setActiveRole] = useState<'buyer' | 'seller'>('buyer');
  const [selectedOffer, setSelectedOffer] = useState<OfferTimelineType | null>(null);
  const [userState, setUserState] = useState<AppUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [idvOpen, setIdvOpen] = useState<{ open: boolean; refId?: string }>(
    { open: false, refId: undefined }
  );

  const [applicationsCount, setApplicationsCount] = useState(0);
  const [escrowsCount, setEscrowsCount] = useState(0);

  useEffect(() => { setPersistence(auth, browserLocalPersistence).catch(() => { }); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setAuthError('Not signed in.');
          setUserState(null);
          setLoadingUser(false);
          setTimeout(() => {
            navigate("/");
          }, 2000);
          return;
        }
        const userDoc = await fetchUserByUid(u.uid);
        setUserState(userDoc);
        const role = userDoc.activeRole === 'seller' ? 'seller' : 'buyer';
        setActiveRole(role);
        if (role === 'buyer' && activeView === 'properties') setActiveView('offers');
      } catch (e: any) {
        setAuthError(e?.message || 'Failed to load user profile.');
      } finally {
        setLoadingUser(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      if (!userState) return;
      try {
        const field = activeRole === "seller" ? "sellerUid" : "buyerUid";
        const qy = query(collection(db, "offers"), where(field, "==", userState.uid));
        const snap = await getDocs(qy);
        const offers = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as OfferDoc[];
        setApplicationsCount(offers.length);
        setEscrowsCount(offers.filter(o => o.state === "ESCROW_CREATED" || o.state === "COMPLETED").length);
      } catch {
        setApplicationsCount(0);
        setEscrowsCount(0);
      }
    })();
  }, [userState, activeRole]);

  // Load existing wallet connections when user state changes
  useEffect(() => {
    if (userState) {
      // Set XRPL address if user has one
      if (userState.xrplAddress) {
        setXrplAddress(userState.xrplAddress);
        // Load balance for XRPL wallet
        getXrpBalance(userState.xrplAddress).then(setXrplBalance).catch(console.error);
      }
      // Note: evmAddress is already in userState, no need to set local state
    }
  }, [userState]);

  const baseSidebarItems = [
    { name: 'Properties', icon: <FaBuilding />, view: 'properties', roles: ['seller'] },
    { name: 'Offers', icon: <FaTags />, view: 'offers', roles: ['buyer', 'seller'] },
    { name: 'Payments', icon: <FaCreditCard />, view: 'payments', roles: ['buyer', 'seller'] },
  ];
  const visibleSidebarItems = baseSidebarItems.filter(item => item.roles.includes(activeRole));

  const handleAuthClick = () => {
    if (auth.currentUser) signOut(auth).catch(() => { });
    else window.location.href = "/login";
  };

  const handleConnectMetaMask = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not detected. Please install MetaMask.");
        return;
      }

      // Check if user is already connected to XRPL wallet
      if (userState?.xrplAddress) {
        const disconnect = confirm("You are already connected to Crossmark (XRPL). Connecting to MetaMask will disconnect your XRPL wallet. Continue?");
        if (!disconnect) return;

        // Disconnect XRPL wallet first
        await updateDoc(doc(db, "users", auth.currentUser!.uid), {
          xrplAddress: null,
          walletType: null
        });
        setUserState((u) => (u ? { ...u, xrplAddress: undefined, walletType: undefined } as AppUser : u));
        setXrplAddress(undefined);
        setXrplBalance(undefined);
      }

      const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const account = (accounts?.[0] || "").toLowerCase();
      if (!account) {
        alert("No account selected.");
        return;
      }
      if (!auth.currentUser) {
        alert("You must be signed in to connect a wallet.");
        return;
      }
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, { evmAddress: account, walletType: "metamask" });
      setUserState((u) => (u ? { ...u, evmAddress: account, walletType: "metamask" } as AppUser : u));

      // Clean up existing listeners and set new ones
      try {
        window.ethereum.removeAllListeners?.("accountsChanged");
        window.ethereum.removeAllListeners?.("chainChanged");
      } catch { }

      window.ethereum.on?.("accountsChanged", async (accs: string[]) => {
        const next = (accs?.[0] || "").toLowerCase();
        if (!auth.currentUser) return;
        await updateDoc(userRef, { evmAddress: next || null });
        setUserState((u) => (u ? { ...u, evmAddress: next || undefined } as AppUser : u));
      });

      window.ethereum.on?.("chainChanged", (_chainId: string) => {
        // could refresh or update UI
      });

      alert("MetaMask connected.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to connect MetaMask.");
    }
  };

  const handleSendTestXrp = async () => {
    try {
      if (!xrplAddress) {
        alert("Connect Crossmark first.");
        return;
      }
      setXrplBusy(true);

      const txHash = await payWithCrossmark({
        from: xrplAddress,
        to: xrplAddress,
        amountXrp: 0.000001, // 1 drop
        memotext: "Libreprop XRPL test",
      });

      setTimeout(async () => {
        const bal = await getXrpBalance(xrplAddress);
        setXrplBalance(bal);
      }, 3000);

      if (auth.currentUser) {
        const logRef = doc(collection(db, "users", auth.currentUser.uid, "xrplLogs"));
        await setDoc(logRef, {
          network: "XRPL Testnet",
          txHash,
          type: "test_payment",
          createdAt: new Date(),
        });
      }

      alert(`XRPL payment submitted.\nTx: ${txHash}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "XRPL payment failed.");
    } finally {
      setXrplBusy(false);
    }
  };

  const handleConnectCrossMark = async () => {
    try {
      setXrplBusy(true);

      // Check if user is already connected to MetaMask wallet
      if (userState?.evmAddress) {
        const disconnect = confirm("You are already connected to MetaMask (EVM). Connecting to Crossmark will disconnect your MetaMask wallet. Continue?");
        if (!disconnect) return;

        // Disconnect MetaMask wallet first
        await updateDoc(doc(db, "users", auth.currentUser!.uid), {
          evmAddress: null,
          walletType: null
        });
        setUserState((u) => (u ? { ...u, evmAddress: undefined, walletType: undefined } as AppUser : u));
      }

      const addr = await connectCrossmark(); // opens Crossmark, gets address
      setXrplAddress(addr);

      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          xrplAddress: addr,
          walletType: "crossmark",
        });
        setUserState(u => u ? { ...u, xrplAddress: addr, walletType: "crossmark" } : u);
      }

      const bal = await getXrpBalance(addr);
      setXrplBalance(bal);

      alert("Crossmark connected.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to connect Crossmark.");
    } finally {
      setXrplBusy(false);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      if (!auth.currentUser) return;

      const userRef = doc(db, "users", auth.currentUser.uid);

      if (userState?.evmAddress) {
        // Disconnect MetaMask and clean up listeners
        try {
          window.ethereum.removeAllListeners?.("accountsChanged");
          window.ethereum.removeAllListeners?.("chainChanged");
        } catch { }

        await updateDoc(userRef, {
          evmAddress: null,
          walletType: null
        });
        setUserState((u) => (u ? { ...u, evmAddress: undefined, walletType: undefined } as AppUser : u));
        alert("MetaMask wallet disconnected.");
      } else if (userState?.xrplAddress) {
        // Disconnect Crossmark
        await updateDoc(userRef, {
          xrplAddress: null,
          walletType: null
        });
        setUserState((u) => (u ? { ...u, xrplAddress: undefined, walletType: undefined } as AppUser : u));
        setXrplAddress(undefined);
        setXrplBalance(undefined);
        alert("Crossmark wallet disconnected.");
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to disconnect wallet.");
    }
  };

  const handleSwitchWallet = async (targetWalletType: 'metamask' | 'crossmark') => {
    try {
      if (!auth.currentUser) return;

      const currentWallet = userState?.evmAddress ? 'metamask' : userState?.xrplAddress ? 'crossmark' : null;

      if (currentWallet === targetWalletType) {
        alert(`You are already connected to ${targetWalletType === 'metamask' ? 'MetaMask' : 'Crossmark'}.`);
        return;
      }

      const confirmSwitch = confirm(`Switch from ${currentWallet === 'metamask' ? 'MetaMask' : 'Crossmark'} to ${targetWalletType === 'metamask' ? 'MetaMask' : 'Crossmark'}? This will disconnect your current wallet.`);

      if (!confirmSwitch) return;

      // Disconnect current wallet first
      await handleDisconnectWallet();

      // Connect to new wallet type
      if (targetWalletType === 'metamask') {
        await handleConnectMetaMask();
      } else {
        await handleConnectCrossMark();
      }

    } catch (e: any) {
      console.error(e);
      alert("Failed to switch wallet.");
    }
  };

  /* escrow create: deploy on XRPL EVM + write escrows/{offerId} */
  const handleStartCreateEscrow = async (offer: OfferTimelineType) => {
    try {
      if (!auth.currentUser) throw new Error("Not signed in");
      if (!userState?.evmAddress) throw new Error("Connect MetaMask first");

      // mark creating + clear prior error
      await updateDoc(doc(db, "offers", offer.id), {
        escrowStatus: "creating",
        escrowError: null,
      });

      const buyerProfile = await fetchUserByUid(offer.buyerUid);
      const sellerProfile = await fetchUserByUid(offer.sellerUid);
      const buyerAddr = (buyerProfile.evmAddress || "").toLowerCase();
      const sellerAddr = (sellerProfile.evmAddress || "").toLowerCase();
      if (!buyerAddr || !sellerAddr) throw new Error("Buyer/Seller EVM address missing");

      const signer = await getSignerXRPL();
      const me = (await signer.getAddress()).toLowerCase();
      if (me !== buyerAddr) throw new Error("Active wallet must be buyer");

      const amountWei = ethers.parseEther(String(offer.amount || 0));
      const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

      const factory = new ethers.ContractFactory(
        (EscrowAbi as any).abi,
        (EscrowAbi as any).bytecode,
        signer
      );

      const contract = await factory.deploy(
        buyerAddr,
        sellerAddr,
        ethers.ZeroAddress,     // arbiter 
        ethers.ZeroAddress,     // token = native XRP
        amountWei,
        deadline
      );
      await contract.waitForDeployment();
      const escrowAddress = await contract.getAddress();

      const escrowId = offer.id;
      await initEscrowDoc(escrowId, {
        offerId: offer.id,
        buyerAddressEvm: buyerAddr,
        sellerAddressEvm: sellerAddr,
        amountWei,
        deadline,
        escrowAddress,
      });

      await updateDoc(doc(db, "offers", offer.id), {
        escrowAddress,
        escrowStatus: "created",
        state: "ESCROW_CREATED",
      });

      alert(`Escrow created: ${escrowAddress}`);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Could not create escrow.";
      alert(msg);
      try {
        await updateDoc(doc(db, "offers", offer.id), {
          escrowStatus: "error",
          escrowError: msg,
        });
      } catch { }
    }
  };
  // come back to integrate properly strip verify
  const handleStartVerifyId = async (offer: OfferTimelineType) => {
    try {
      await updateDoc(doc(db, "offers", offer.id), { idvStatus: "pending" });
      setIdvOpen({ open: true, refId: offer.id });
    } catch (e) {
      console.error(e);
      alert("Could not start verification.");
    }
  };




  if (loadingUser) return <div className="h-screen flex items-center justify-center text-slate-600">Loading dashboard…</div>;
  if (authError) return <div className="h-screen flex items-center justify-center text-red-600">{authError}</div>;
  if (!userState) return <div className="h-screen flex items-center justify-center text-slate-600">No user profile.</div>;

  return (
    <Fragment>
      <div className="h-screen flex flex-col bg-slate-50 text-[#202124]">
        <div className='flex flex-1 overflow-hidden'>
          {/* sidebar */}
          <aside className='w-72 flex-shrink-0 bg-white p-6 shadow-md'>
            <div onClick={() => navigate('/')} className="flex flex-row items-center mb-6 justify-between ">
              <button className="flex items-center">
                <img src={Logo} className="h-12 mr-3" alt="Libreprop Logo" />
                <h1 className="text-3xl font-bold text-[#202124]">Libreprop</h1>
              </button>
            </div>
            <div className="flex flex-col gap-y-3">
              {visibleSidebarItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setActiveView(item.view as any)}
                  className={`w-full flex items-center gap-x-4 px-4 py-3 rounded-lg text-base font-semibold transition-colors duration-200 ${activeView === item.view
                    ? 'bg-[#FF6D4D] text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.name}</span>
                </button>
              ))}
              <button onClick={handleAuthClick} className="px-3 py-2 rounded-lg bg-[#FF6D4D] text-white text-sm font-semibold hover:bg-[#e85f41]">
                {auth.currentUser ? 'Sign out' : 'Sign in'}
              </button>
            </div>
          </aside>

          {/* main */}
          <div className='flex-1 overflow-y-auto'>
            <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8 w-full">
              <header className="flex flex-col sm:flex-row items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                <div className="mt-4 sm:mt-0 text-sm text-slate-500 capitalize">Role: {activeRole}</div>
              </header>

              <StatsBar applications={applicationsCount} escrows={escrowsCount} />

              <div>
                {activeView === 'properties' && userState && (
                  <PropertiesView activeRole={activeRole} ownerUid={userState.uid} />
                )}
                {activeView === 'offers' && (
                  <OffersView
                    activeRole={activeRole}
                    onViewOffer={(o) => setSelectedOffer(o)}
                  />
                )}
                {activeView === 'payments' && (
                  <PaymentsView
                    evmAddress={userState?.evmAddress}
                    onConnectMetaMask={handleConnectMetaMask}
                    onConnectXRPL={handleConnectCrossMark}
                    onDisconnectWallet={handleDisconnectWallet}
                    onSwitchWallet={handleSwitchWallet}
                    xrplAddress={xrplAddress || userState?.xrplAddress}
                    xrplBalance={xrplBalance}
                    xrplBusy={xrplBusy}
                    onSendTestXrp={handleSendTestXrp}
                  />
                )}
              </div>
            </main>
          </div>
        </div>
      </div>

      <OfferTimelineModal
        offer={selectedOffer}
        role={activeRole}
        buyerEvmAddress={userState?.evmAddress}
        onClose={() => setSelectedOffer(null)}
        onStartVerifyId={handleStartVerifyId}
        onStartCreateEscrow={handleStartCreateEscrow}
      />

      {/* Simple IDV Dialog */}
      {idvOpen.open && userState && (
        <SimpleIdvDialog
          isOpen={idvOpen.open}
          onClose={() => setIdvOpen({ open: false })}
          referenceId={idvOpen.refId!}
          userUid={userState.uid}
          onComplete={async () => {
            if (!idvOpen.refId) return;
            try {
              await updateDoc(doc(db, "offers", idvOpen.refId), { idvStatus: "verified" });
            } catch { }
          }}
        />
      )}
    </Fragment>
  );
};

export default SellDashboard;
