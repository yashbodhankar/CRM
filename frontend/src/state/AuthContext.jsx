import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/api';
import { AUTH_INVALID_EVENT } from '../utils/api';

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  const raw = String(token || '').split('.')[1] || '';
  if (!raw) return null;

  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const payload = JSON.parse(atob(padded));

  if (payload?.exp && Date.now() >= payload.exp * 1000) {
    return null;
  }

  return payload;
}

function toUser(payload) {
  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const payload = decodeJwtPayload(token);
      if (!payload) {
        localStorage.removeItem('token');
        setUser(null);
      } else {
        setUser(toUser(payload));
      }
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleAuthInvalid = () => {
      localStorage.removeItem('token');
      setUser(null);
    };

    window.addEventListener(AUTH_INVALID_EVENT, handleAuthInvalid);
    return () => {
      window.removeEventListener(AUTH_INVALID_EVENT, handleAuthInvalid);
    };
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token } = res.data;
    localStorage.setItem('token', token);
    const payload = decodeJwtPayload(token);
    if (!payload) {
      localStorage.removeItem('token');
      setUser(null);
      throw new Error('Received an expired or invalid token. Please sign in again.');
    }
    setUser(toUser(payload));
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const syncUser = (next) => {
    if (!next) return;
    setUser((prev) => ({
      ...(prev || {}),
      id: next.id ?? prev?.id,
      name: next.name ?? prev?.name,
      email: next.email ?? prev?.email,
      role: next.role ?? prev?.role
    }));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, syncUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

