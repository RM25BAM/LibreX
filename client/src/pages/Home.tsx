import Navbar from "../components/Navbar"
import { useLenis } from '../hooks/useLenis';
//import Video from "../assets/hero.mp4"
//import HorizontalScrollCarousel from "../components/HorizontalScroll.tsx"
import { Footer } from "../components/Footer.tsx"
//import TrippyScroll from "../components/TripScroll.tsx";
//import Marquee from "../components/ScrollMarquee.tsx"
import { Reveal } from "../components/Reveal.tsx";
import  StickyScroll  from "../components/sticky-scroll-vertical.tsx"; 
//import {VelocityText} from "../components/VelocityScroll.tsx"
import Pricing from "../components/Pricing.tsx";
const Home = () => {
    useLenis();
    return (
        <div className="flex-row bg-black/15">
            <div className="top-0 sticky z-50">
                <Navbar />
            </div>
            <div className="w-screen h-[60svh]">
                {/* <video
                    className="absolute top-0 left-0 w-full h-svh object-cover -z-10"
                    autoPlay
                    loop
                    muted
                    playsInline
                    src={Video}
                /> */}
                <div className="flex justify-around mt-60 w-250 z-5 bg-gray-600 place-content-center">
                    <div>
                        <h1 className="font-extrabold text-7xl text-shadow-gray-400 text-white text-shadow-2xs">Secure Real Estate Offers.<br /> On-Chain. No Middlemen.</h1>
                        <h3 className="text-white text-shadow-2md font-bold text-xl pt-3 mx-2">Built for digital-first buyers and sellers. Borderless, secure, and scalable.</h3>
                        <h3 className="text-white font0bold">ADD SEARCH BAR FOR THE LISTINGS</h3>
                    </div>
                    <div className="text-transparent">
                        .
                    </div>
                </div>
            </div>
            {/* <div className="w-screen h-screen">
                <h1>add latest property listing</h1>
            </div> */}
            <div className=" h-[70svh] bg-black">
                <Reveal />
            </div>
            {/* <div className="h-[240vh]">
                <h1>
                    scroll down and text sliding up 
                </h1>
            </div> */}
            <StickyScroll />
            <div>
                <h1>
                    adapted to phone and web
                </h1>
            </div>
            {/* <HorizontalScrollCarousel /> */}
            {/* <Marquee /> */}
            <Pricing />
            <div className="h-max text-7xl text-white items-center">
        
            </div>
            <Footer />
        </div>
    )
}

export default Home