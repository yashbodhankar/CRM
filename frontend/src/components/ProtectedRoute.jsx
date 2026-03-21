import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { canAccess } from '../utils/rbac';

function ProtectedRoute({ children, allowedRoles, requiredPermissions }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (Array.isArray(requiredPermissions) && requiredPermissions.length > 0 && !canAccess(user.role, requiredPermissions)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;

