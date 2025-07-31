// Your AuthForm component file
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { auth } from "../../firebase"; 
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    updateProfile,
} from "firebase/auth";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    setDoc,
    doc,
} from "firebase/firestore";
import { toast } from "react-toastify";

const db = getFirestore();
const inputStyleClasses = "flex h-10 w-full rounded-md border-none bg-zinc-800 px-3 py-2 text-sm text-white shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 focus-visible:ring-[2px] focus-visible:ring-cyan-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";


export default function AuthForm() {
    const [isLogin, setIsLogin] = useState(true);
    const [identifier, setIdentifier] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- All your existing functionality remains unchanged ---
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
            return snapshot.docs[0].data().email;
        }
        throw new Error("Username not found");
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
                await updateProfile(user, {
                    displayName: username,
                });
                await setDoc(doc(db, "users", user.uid), {
                    username,
                    email: identifier,
                });
                toast.success("Account created! 🎉");
            } else {
                let emailToUse = identifier;
                if (!isEmail(identifier)) {
                    emailToUse = await getEmailFromUsername(identifier);
                }
                await signInWithEmailAndPassword(auth, emailToUse, password);
                toast.success("Logged in successfully ✅");
            }
        } catch (error: any) {
            toast.error(error.message || "Something went wrong.");
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
                const username = email.split('@')[0];
                const userDocRef = doc(db, "users", user.uid);

                const docSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));

                if (docSnap.empty) {
                     await setDoc(userDocRef, {
                        username: username,
                        email: email,
                    });
                     await updateProfile(user, {
                        displayName: username,
                    });
                }
               
                toast.success("Google login successful 🚀");
            } else {
                toast.error("Could not retrieve user info from Google.");
            }
        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user') {
                toast.info("Google login cancelled.");
            } else {
                toast.error(error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
            <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-white/10 p-8 space-y-6">
                <h2 className="text-3xl font-bold text-white text-center">
                    {isLogin ? "Welcome Back" : "Create an Account"}
                </h2>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="space-y-2">
                            <label htmlFor="username" className="text-sm font-medium text-neutral-300 leading-none">Username</label>
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
                         <label htmlFor="identifier" className="text-sm font-medium text-neutral-300 leading-none">
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
                        <label htmlFor="password" className="text-sm font-medium text-neutral-300 leading-none">Password</label>
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
                            <label htmlFor="confirm-password" className="text-sm font-medium text-neutral-300 leading-none">Confirm Password</label>
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
                            /* bg-gradient-to-r from-cyan-500 to-emerald-500 */
                            className="w-full py-3 px-4  text-white font-semibold rounded-lg bg-gray-500 shadow-md hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <span className="bg-zinc-900 px-2 text-neutral-400">
                            Or continue with
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-3 py-2.5 px-4 border border-zinc-700 text-white rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                    <FcGoogle className="text-xl" />
                    <span className="text-sm font-medium">Continue with Google</span>
                </button>

                <p className="mt-4 text-center text-sm text-neutral-400">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button
                        type="button"
                        onClick={toggleMode}
                        className="font-medium text-cyan-400 hover:underline"
                    >
                        {isLogin ? "Sign up" : "Log in"}
                    </button>
                </p>
            </div>
        </div>
    );
}