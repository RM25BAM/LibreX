import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "../../firebase";
import Logo from '.././../public/logo.svg';

const Navbar = () => {
    const [navbar, setNavbar] = useState(false);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    const changeNav = () => {
        setNavbar(window.scrollY >= 20);
    };

    useEffect(() => {
        setPersistence(auth, browserLocalPersistence).catch(() => { });
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        window.addEventListener("scroll", changeNav);
        changeNav();
        return () => {
            unsub();
            window.removeEventListener("scroll", changeNav);
        };
    }, []);

    const handleAuthClick = () => {
        if (user) {
            signOut(auth).catch(() => { });
        } else {
            navigate('/login');
        }
    };

    return (
        <nav
            // make it look like zonaprop and zillow had a baby
            className={`sticky top-0 z-50 flex w-full items-center justify-between h-20 px-4 sm:px-6 lg:px-8 py-5 transition-colors duration-300 ${navbar
                ? "bg-white/70 backdrop-blur-sm border-b border-gray-200"
                : "bg-transparent"
                }`}
        >
            {/* Left-side */}
            <div className="flex items-center gap-x-4 md:gap-x-8">
                <button className="text-[#202124] text-md" onClick={() => navigate('/sellListing')}>Buy</button>
                <button className="text-[#202124] text-md" onClick={() => navigate('/rentListing')}>Rent</button>
            </div>

            {/* Centered Logo */}
            <div>
                <button className="flex flex-row items-center gap-x-2" onClick={() => navigate('/')}>
                    <img src={Logo} className="h-10 md:h-12" alt="Libreprop Logo" />
                    <h1 className="hidden sm:block text-2xl md:text-3xl font-bold text-[#202124]">Libreprop</h1>
                </button>
            </div>

            {/* Right-side Links */}
            <div className="flex items-center gap-x-4 md:gap-x-8">
                <button onClick={() => navigate('/selldashboard')} className="text-[#202124] text-md hover:text-gray-700">Manage Listing</button>
                <button className="text-[#202124] font-bold text-md hover:text-gray-700" onClick={handleAuthClick}>
                    {user ? 'Sign out' : 'Sign in'}
                </button>
            </div>
        </nav>
    );
};

export default Navbar;