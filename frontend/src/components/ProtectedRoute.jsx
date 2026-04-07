import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { canAccess } from '../utils/rbac';

function ProtectedRoute({ children, allowedRoles, requiredPermissions }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 text-sm">
          <span className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" aria-hidden="true" />
          <span>Preparing your workspace...</span>
        </div>
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

