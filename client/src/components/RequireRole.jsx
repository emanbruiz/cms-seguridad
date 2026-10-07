import { Link, Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

export default function RequireRole({ roles, allowWithoutMfa = false, children }) {
  const { user, mfa, loading } = useAuth();

  if (loading) return <p>Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <p className="text-red-600">No tenés permiso para ver esta página.</p>;
  }

  if (user.role === 'admin' && !allowWithoutMfa && !(user.mfaEnabled && mfa)) {
    return (
      <p className="text-red-600">
        {user.mfaEnabled
          ? 'Cerrá sesión y volvé a ingresar para verificar tu MFA.'
          : 'Como admin necesitás activar el MFA para usar esta sección.'}{' '}
        <Link to="/security" className="underline">Ir a Seguridad</Link>
      </p>
    );
  }
  return children;
}