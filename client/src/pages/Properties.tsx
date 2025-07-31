import Navbar from "../components/Navbar"
import { useLenis } from "../hooks/useLenis"

const Properties = () => {
  useLenis();
  return (
    <>
      <div className="bg-white h-[400svh] top-0">
        <Navbar />
        <div>
          
        </div>
      </div>
    </>
  )
}

export default Properties