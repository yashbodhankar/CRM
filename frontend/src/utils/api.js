import axios from 'axios';

const LOCAL_API_CANDIDATES = ['http://localhost:5003', 'http://localhost:5000'];

function normalizeOrigin(url) {
  return String(url || '').replace(/\/$/, '');
}

function resolveBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return `${normalizeOrigin(import.meta.env.VITE_API_URL)}/api`;
  }
  return `${LOCAL_API_CANDIDATES[0]}/api`;
}

const api = axios.create({
  baseURL: resolveBaseUrl()
});

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
        .map((candidate) => `${normalizeOrigin(candidate)}/api`)
        .find((candidate) => candidate !== current);
      if (fallback) {
        config.__baseUrlRetried = true;
        config.baseURL = fallback;
        api.defaults.baseURL = fallback;
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

