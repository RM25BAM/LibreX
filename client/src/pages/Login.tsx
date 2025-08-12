import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { auth } from "../../firebase";
import Logo from "/logo.svg";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    updateProfile,
} from "firebase/auth";
import Video from "../assets/hero.mp4";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    setDoc,
    doc,
    getDoc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const db = getFirestore();

const inputStyleClasses =
    "flex h-10 w-full rounded-md border-none bg-[#E2E2E6] px-3 py-2 text-sm text-black shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 focus-visible:ring-[2px] focus-visible:ring-[#e85f41] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export default function AuthForm() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [identifier, setIdentifier] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEmail = (str: string) => /\S+@\S+\.\S+/.test(str);

    const toggleMode = () => {
        setIsLogin((prev) => !prev);
        setPassword("");
        setConfirmPassword("");
        setUsername("");
    };

    const getEmailFromUsername = async (name: string) => {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", name));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data().email as string;
        }
        throw new Error("Username not found");
    };

    // roles / activeRole gate from firebase db
    const allowedRoles = new Set(["buyer", "seller", "tenant", "landlord", "buyer_seller"]);

    const checkRoleAndRedirect = async (uid: string) => {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) {
            navigate("/roles");
            return;
        }

        const data = snap.data() as { activeRole?: string; roles?: string[] } | undefined;
        const roles = Array.isArray(data?.roles) ? data!.roles : [];
        const activeRole = (data?.activeRole || "").toString();

        const hasAnyAllowed = roles.some((r) => allowedRoles.has(r));
        const isActiveValid = !!activeRole && allowedRoles.has(activeRole) && roles.includes(activeRole);

        if (!hasAnyAllowed || !isActiveValid) {
            toast.info("Please choose your role to continue.");
            navigate("/roles");
            return;
        }
        else if (activeRole === "tenant" || activeRole === "landlord") {
            navigate("/rentListing");
        }
        else if (activeRole === "buyer" || activeRole === "seller") {
            navigate("/sellListing");
        }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (!isLogin) {
                if (password !== confirmPassword) {
                    toast.error("Passwords do not match.");
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, identifier, password);
                const user = userCredential.user;

                await updateProfile(user, { displayName: username });
                await setDoc(doc(db, "users", user.uid), {
                    username,
                    email: identifier,
                    roles: ["buyer", "seller", "tenant", "landlord", "buyer_seller"],
                    activeRole: "",
                    xrplAddress: "",
                    evmAddress: "",
                    walletType: "",
                });

                toast.success("Account created! Welcome!");
                navigate("/roles");
            } else {
                let emailToUse = identifier;
                if (!isEmail(identifier)) {
                    emailToUse = await getEmailFromUsername(identifier);
                }
                const cred = await signInWithEmailAndPassword(auth, emailToUse, password); // <-- define cred
                toast.success("Logged in successfully");

                const uid = cred.user?.uid || auth.currentUser?.uid;
                if (uid) {
                    await checkRoleAndRedirect(uid);
                }
            }
        } catch (error: any) {
            toast.error(error?.message || "Something went wrong.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setIsSubmitting(true);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            if (user && user.email) {
                const email = user.email;
                const uname = email.split("@")[0];
                const userDocRef = doc(db, "users", user.uid);
                const existingByEmail = await getDocs(query(collection(db, "users"), where("email", "==", email)));
                if (existingByEmail.empty) {
                    await setDoc(userDocRef, {
                        username: uname,
                        email,
                        roles: ["buyer", "seller", "tenant", "landlord", "buyer_seller"],
                        activeRole: "",
                        xrplAddress: "",
                        evmAddress: "",
                        walletType: "",
                    });
                    await updateProfile(user, { displayName: uname });
                }

                toast.success("Google login successful 🚀");
                await checkRoleAndRedirect(user.uid);
            } else {
                toast.error("Could not retrieve user info from Google.");
            }
        } catch (error: any) {
            if (error.code === "auth/popup-closed-by-user") {
                toast.info("Google login cancelled.");
            } else {
                toast.error(error.message || "Google login failed.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleClick = () => {
        navigate("/");
    };
    return (
        <div className="min-h-screen flex">
            <video
                className="absolute top-0 left-0 w-full h-svh object-cover -z-10 opacity-80 blur-xs"
                autoPlay
                loop
                muted
                playsInline
                src={Video}
            />
            <div className="w-full max-w-xl bg-white shadow-2xl border border-white/10 p-8 space-y-6">
                <button onClick={() => handleClick()} className="flex flex-row items-center mb-20 ">
                    <img src={Logo} className="h-12 mr-3" alt="Libreprop Logo" />
                    <h1 className="text-3xl font-bold text-[#202124]">Libreprop</h1>
                </button>
                <h2 className="text-3xl font-bold text-[#202124] text-center">
                    {isLogin ? "Welcome Back" : "Create an Account"}
                </h2>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="space-y-2">
                            <label htmlFor="username" className="text-sm font-medium text-[#202124] leading-none">
                                Username
                            </label>
                            <input
                                id="username"
                                placeholder="Username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className={inputStyleClasses}
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="identifier" className="text-sm font-medium text-[#202124] leading-none">
                            {isLogin ? "Username or Email" : "Email"}
                        </label>
                        <input
                            id="identifier"
                            placeholder={isLogin ? "Username or Email" : "you@example.com"}
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className={inputStyleClasses}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium text-[#202124] leading-none">
                            Password
                        </label>
                        <input
                            id="password"
                            placeholder="••••••••"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputStyleClasses}
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div className="space-y-2">
                            <label htmlFor="confirm-password" className="text-sm font-medium text-[#202124] leading-none">
                                Confirm Password
                            </label>
                            <input
                                id="confirm-password"
                                placeholder="••••••••"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={inputStyleClasses}
                                required
                            />
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 px-4 text-white font-semibold rounded-lg bg-[#FF6D4D] shadow-md hover:scale-[1.02] hover:bg-[#ff6e4df0] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting
                                ? isLogin
                                    ? "Logging In..."
                                    : "Creating Account..."
                                : isLogin
                                    ? "Log In"
                                    : "Sign Up"}
                        </button>
                    </div>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-zinc-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-[#202124]">Or continue with</span>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-3 py-2.5 px-4 border border-slate-300 text-[#202124] rounded-lg bg-white hover:bg-[#E2E2E7] hover:border-[#E2E2E7] transition-colors disabled:opacity-50 shadow-2xl"
                >
                    <FcGoogle className="text-xl transition-opacity group-hover:opacity-0" />
                    <span className="text-sm font-medium">Continue with Google</span>
                </button>

                <p className="mt-4 text-center text-sm text-neutral-400">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button type="button" onClick={toggleMode} className="font-medium text-[#0096FF] hover:underline">
                        {isLogin ? "Sign up" : "Log in"}
                    </button>
                </p>
            </div>
        </div>
    );
}
