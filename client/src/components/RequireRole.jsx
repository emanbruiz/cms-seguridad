import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p>Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <p className="text-red-600">No tenés permiso para ver esta página.</p>;
  }
  return children;
}