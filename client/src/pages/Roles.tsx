import { useState, useEffect } from "react";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Logo from "/logo.svg";
import { toast } from "react-toastify";

const db = getFirestore();
const auth = getAuth();

const Roles = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const roleOptions = [
        { id: "buyer", label: "Buyer", subheading: "Find your next property" },
        { id: "seller", label: "Seller", subheading: "List and sell with ease" },
        { id: "tenant", label: "Tenant", subheading: "Discover rental opportunities" },
        { id: "landlord", label: "Landlord", subheading: "Manage your rental portfolio" },
        { id: "buyer_seller", label: "Buyer & Seller", subheading: "Engage in both buying and selling" },
    ];

    const handleRoleSelect = async (role) => {
        if (loading) return;
        
        const currentUser = auth.currentUser;
        if (!currentUser) {
            toast("Authentication error: No user found. Please sign in again.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, { activeRole: role });
            if(role === "buyer"){
                navigate("/sellListing");
            }
            else if (role === "tenant"){
                navigate("/rentListing");

            }
            else if (role === "Seller"){
                navigate("/selldashboard");

            }
            else if (role === "landlord"){
                navigate("/rentdashboard");

            }
        } catch (err) {
            console.error("Error updating role:", err);
            toast("Failed to update your role. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleKeyPress = (event) => {
            if (loading) return;
            const key = event.key.toLowerCase();
            const keyIndex = key.charCodeAt(0) - 97; 

            if (keyIndex >= 0 && keyIndex < roleOptions.length) {
                handleRoleSelect(roleOptions[keyIndex].id);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [loading]);

    return (
        <div className="min-h-screen bg-white flex justify-center items-center p-4">
            <div className="w-full max-w-2xl">
                <div className="flex flex-row items-center mb-10 pl-2">
                    <img src={Logo} className="h-12 mr-3" alt="Libreprop Logo" />
                    <h1 className="text-4xl font-bold text-[#202124]">Libreprop</h1>
                </div>

                <div className="mb-6 pl-2">
                    <h2 className="text-2xl font-bold text-[#202124]">Choose Your Role</h2>
                    <p className="text-[#5F6368] mt-1">Select how you'd like to use the platform.</p>
                </div>

                <div className="space-y-3">
                    {roleOptions.map((role, index) => (
                        <TypeformRoleOption
                            key={role.id}
                            optionKey={String.fromCharCode(65 + index)}
                            label={role.label}
                            subheading={role.subheading}
                            onClick={() => handleRoleSelect(role.id)}
                            disabled={loading}
                        />
                    ))}
                </div>

                {error && <p className="text-red-500 mt-6 font-medium text-center">{error}</p>}
            </div>
        </div>
    );
};
const TypeformRoleOption = ({ optionKey, label, subheading, onClick, disabled }) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="group w-full flex items-center p-3.5 rounded-lg bg-[#E7E7E9] border-2 border-transparent hover:border-[#FF6D4D] hover:bg-neutral-50 focus:outline-none focus-visible:border-[#FF6D4D] focus-visible:bg-neutral-50 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
        >
            <div className="flex items-center justify-center h-8 w-8 rounded bg-neutral-100 border border-neutral-300 text-sm font-bold text-neutral-600 group-hover:border-[#FF6D4D] group-hover:text-[#FF6D4D] transition-all duration-200">
                {optionKey}
            </div>
            <div className="ml-4 text-left">
                <div className="font-semibold text-neutral-800">{label}</div>
                <div className="text-sm text-neutral-500">{subheading}</div>
            </div>
        </button>
    );
};

export default Roles;