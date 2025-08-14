import React, { useEffect, useRef, useState } from "react";
import { FaIdCard, FaTimes, FaUpload } from "react-icons/fa";
import { storage } from "../../firebase";
import { ref as storageRef, uploadBytes } from "firebase/storage";

const Button = ({ children, onClick, variant = "primary", disabled = false, className = "" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary"; disabled?: boolean; className?: string }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-4 h-10 text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${variant === "primary" ? "bg-[#FF6D4D] text-white hover:bg-[#e85f41]" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            } ${className}`}
    >
        {children}
    </button>
);

export default function SimpleIdvDialog({
    isOpen,
    onClose,
    referenceId,
    userUid,
    onComplete,
}: {
    isOpen: boolean;
    onClose: () => void;
    referenceId: string;
    userUid: string;
    onComplete: () => void;
}) {
    const [idImage, setIdImage] = useState<File | null>(null);
    const [selfie, setSelfie] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [dragIdOver, setDragIdOver] = useState(false);
    const [dragSelfieOver, setDragSelfieOver] = useState(false);
    const [idPreviewUrl, setIdPreviewUrl] = useState<string | null>(null);
    const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);

    const hiddenIdInputRef = useRef<HTMLInputElement | null>(null);
    const hiddenSelfieInputRef = useRef<HTMLInputElement | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!idImage || !selfie) {
            alert("Please upload both an ID image and a selfie.");
            return;
        }
        try {
            setBusy(true);
            const basePath = `idv/${userUid}/${referenceId}`;
            const idRef = storageRef(storage, `${basePath}/id.${idImage.name.split(".").pop() || "jpg"}`);
            const selfieRef = storageRef(storage, `${basePath}/selfie.${selfie.name.split(".").pop() || "jpg"}`);
            await uploadBytes(idRef, idImage);
            await uploadBytes(selfieRef, selfie);
            onComplete();
            onClose();
        } catch (e) {
            alert("Upload failed. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    // Manage preview object URLs
    useEffect(() => {
        if (idImage) {
            const url = URL.createObjectURL(idImage);
            setIdPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setIdPreviewUrl(null);
        }
    }, [idImage]);

    useEffect(() => {
        if (selfie) {
            const url = URL.createObjectURL(selfie);
            setSelfiePreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setSelfiePreviewUrl(null);
        }
    }, [selfie]);

    function acceptImage(file?: File | null) {
        if (!file) return null;
        if (!file.type?.startsWith("image/")) {
            alert("Please upload an image file.");
            return null;
        }
        return file;
    }

    const onDropId = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragIdOver(false);
        if (busy) return;
        const file = acceptImage(e.dataTransfer.files?.[0]);
        if (file) setIdImage(file);
    };

    const onDropSelfie = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragSelfieOver(false);
        if (busy) return;
        const file = acceptImage(e.dataTransfer.files?.[0]);
        if (file) setSelfie(file);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                        <FaIdCard /> Quick ID Verification
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><FaTimes /></button>
                </div>
                <div className="p-5 space-y-5 overflow-y-auto flex-1">
                    {/* Dropzones */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Government ID (front)</label>
                            <div
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragIdOver(true); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragIdOver(true); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragIdOver(false); }}
                                onDrop={onDropId}
                                onClick={() => !busy && hiddenIdInputRef.current?.click()}
                                role="button"
                                aria-label="Upload government ID"
                                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${dragIdOver ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:bg-slate-50"} ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                                {idPreviewUrl ? (
                                    <div className="space-y-2">
                                        <img src={idPreviewUrl} alt="ID preview" className="mx-auto max-h-48 rounded-lg object-contain" />
                                        <div className="text-xs text-slate-600 break-all">{idImage?.name}</div>
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setIdImage(null); }}>Remove</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-500">
                                        <div className="text-sm">Drag & drop your ID here</div>
                                        <div className="text-xs">or click to browse</div>
                                    </div>
                                )}
                                <input ref={hiddenIdInputRef} type="file" accept="image/*" hidden onChange={(e) => setIdImage(acceptImage((e.target.files && e.target.files[0]) || null))} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Selfie</label>
                            <div
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragSelfieOver(true); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragSelfieOver(true); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragSelfieOver(false); }}
                                onDrop={onDropSelfie}
                                onClick={() => !busy && hiddenSelfieInputRef.current?.click()}
                                role="button"
                                aria-label="Upload selfie"
                                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${dragSelfieOver ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:bg-slate-50"} ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                                {selfiePreviewUrl ? (
                                    <div className="space-y-2">
                                        <img src={selfiePreviewUrl} alt="Selfie preview" className="mx-auto max-h-48 rounded-lg object-contain" />
                                        <div className="text-xs text-slate-600 break-all">{selfie?.name}</div>
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setSelfie(null); }}>Remove</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-500">
                                        <div className="text-sm">Drag & drop your selfie here</div>
                                        <div className="text-xs">or click to browse</div>
                                    </div>
                                )}
                                <input ref={hiddenSelfieInputRef} type="file" accept="image/*" hidden onChange={(e) => setSelfie(acceptImage((e.target.files && e.target.files[0]) || null))} />
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500">
                        Your uploads are stored securely in Firebase. For demo purposes, verification will auto-complete once both files are uploaded.
                    </div>
                </div>
                <div className="p-5 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={busy}>
                        <FaUpload /> {busy ? "Uploading…" : "Submit & Verify"}
                    </Button>
                </div>
            </div>
        </div>
    );
}


