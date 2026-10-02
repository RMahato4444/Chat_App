import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="app-bg min-h-screen grid place-items-center text-white/70">Loading GlassChat…</div>;
  return token ? children : <Navigate to="/login" replace />;
}
