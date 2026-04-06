import axios from 'axios';

const HOSTED_BACKEND_ORIGIN = 'https://crm-1-zirz.onrender.com';
const LOCAL_API_CANDIDATES = ['http://localhost:5003', 'http://localhost:5000'];
export const AUTH_INVALID_EVENT = 'crm:auth-invalid';

function normalizeOrigin(url) {
  return String(url || '').replace(/\/$/, '');
}

function toApiBaseUrl(url) {
  const normalized = normalizeOrigin(url);
  if (!normalized) return '';
  if (normalized.endsWith('/api')) return normalized;
  return `${normalized}/api`;
}

function resolveBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return toApiBaseUrl(import.meta.env.VITE_API_URL);
  }

  const host = typeof window !== 'undefined'
    ? String(window.location?.hostname || '').toLowerCase()
    : '';
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return toApiBaseUrl(HOSTED_BACKEND_ORIGIN);
  }

  return toApiBaseUrl(LOCAL_API_CANDIDATES[0]);
}

const api = axios.create({
  baseURL: resolveBaseUrl()
});

function shouldInvalidateAuth(error) {
  const status = error?.response?.status;
  if (status !== 401) return false;

  const message = String(error?.response?.data?.message || '').toLowerCase();
  if (!message) return true;

  return (
    message.includes('invalid token')
    || message.includes('no token provided')
    || message.includes('jwt')
    || message.includes('token expired')
  );
}

function emitAuthInvalid() {
  localStorage.removeItem('token');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_INVALID_EVENT));
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const canRetry = Boolean(config) && !config.__baseUrlRetried;
    const isNetworkIssue = !error?.response;

    if (canRetry && isNetworkIssue) {
      const current = String(config.baseURL || api.defaults.baseURL || '');
      const fallback = LOCAL_API_CANDIDATES
        .map((candidate) => toApiBaseUrl(candidate))
        .find((candidate) => candidate !== current);
      if (fallback) {
        config.__baseUrlRetried = true;
        config.baseURL = fallback;
        api.defaults.baseURL = fallback;
        return api(config);
      }
    }

    const isLoginRequest = String(config?.url || '').includes('/auth/login');
    if (!isLoginRequest && shouldInvalidateAuth(error)) {
      emitAuthInvalid();
    }

    return Promise.reject(error);
  }
);

export default api;

