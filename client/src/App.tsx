import './App.css'
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from "./pages/Home"
import Login from "./pages/Login"
import RentDashboard from './pages/RentDashboard';
import SellDashboard from './pages/SellDashboard';
import Roles from './pages/Roles';
import RentListing from './pages/RentListing';
import SellListing from './pages/SellListing';
import IdentityCallback from './pages/IdentityCallback';
function App() {
  return (
    <div>
      <ToastContainer position="top-right" />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/rentdashboard" element={<RentDashboard />} />
          <Route path="/identity/callback" element={<IdentityCallback />} />
          <Route path="/rentListing" element={<RentListing />} />
          <Route path="/sellListing" element={<SellListing />} />
          <Route path="/sellDashboard" element={<SellDashboard />} />
          <Route path="/roles" element={<Roles />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App
