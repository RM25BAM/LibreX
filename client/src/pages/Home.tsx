import Navbar from "../components/Navbar"
import { useLenis } from '../hooks/useLenis';
import Video from "../assets/hero.mp4"
const Home = () => {
    useLenis();
    return (
        <div className="flex-row">
            <div className="top-0 sticky z-50">
                <Navbar />
            </div>
            <div className="w-screen h-screen">
                <video
                    className="absolute top-0 left-0 w-full h-svh object-cover -z-10"
                    autoPlay
                    loop
                    muted
                    playsInline
                    src={Video}
                />
                <div className="flex justify-around pt-64">
                    <div>
                        <h1 className="space-grotesk-600">Secure Real Estate Offers. On-Chain. No Middlemen.</h1>
                        <h3 className="">Built for digital-first buyers and sellers. Borderless, secure, and scalable.</h3>
                    </div>
                    <div>
                        Container
                    </div>
                </div>

            </div>
            <div className="w-screen h-svh bg-amber-200">
                <h1>Hello</h1>
            </div>
            <div className="w-screen h-svh bg-red-300">
                <h1>Hello</h1>
            </div>
        </div>
    )
}

export default Home