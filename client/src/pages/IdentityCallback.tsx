import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function IdentityCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-700">
      Returning to your dashboard… we’ll update your verification status shortly.
    </div>
  );
}
