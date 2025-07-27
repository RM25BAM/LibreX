import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
    const [navbar, setNavbar] = useState(false);
    const navigate = useNavigate();

    const changeNav = () => {
        setNavbar(window.scrollY >= 5);
    };

    useEffect(() => {
        window.addEventListener("scroll", changeNav);
        changeNav();
        return () => {
            window.removeEventListener("scroll", changeNav);
        };
    }, []);

    return (
        <nav
            className={`sticky top-0 z-50 flex w-full h-auto justify-center gap-10 md:gap-40 md:h-15 p-4 transition-colors duration-300 ${navbar
                    ? "bg-black/10 backdrop-blur-sm border-none"
                    : "bg-transparent border-b-0 backdrop-blur-none"
                }`}
        >
            <button className="text-white font-bold text-md" onClick={() => navigate('/')}>Logo</button>
            <button onClick={() => navigate('/properties')} className="text-white font-bold text-md hover:text-gray-950 hover:animate-pulse">Listing</button>
            <button onClick={() => navigate('/dashboard')} className="text-white font-bold text-md hover:text-gray-950 hover:animate-pulse" >Dashboard</button>
            <div className="flex gap-2">
                <button className="text-white font-bold text-md hover:text-gray-950 hover:animate-pulse" onClick={() => navigate('/login')}>Sign in</button>
            </div>
        </nav>
    );
};

export default Navbar;
