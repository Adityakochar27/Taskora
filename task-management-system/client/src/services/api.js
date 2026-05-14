import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 45000, // generous — Render free tier cold starts can take 30-60s
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || 'Request failed';
    const url = err.config?.url || '';

    // Auth endpoints (login, signup, /me, fcm-token) failing is NORMAL flow —
    // wrong password, signup validation errors, a cold-start FCM hiccup, etc.
    // These must NEVER trigger the global "session expired" logout/redirect,
    // or a failed signup boots the user to the login page.
    const isAuthEndpoint = url.includes('/auth/');

    if (status === 401 && !isAuthEndpoint) {
      // A genuine expired/invalid session on a protected endpoint.
      localStorage.removeItem('tf_token');
      localStorage.removeItem('tf_user');
      toast.error('Session expired. Please log in again.');
      if (location.pathname !== '/login' && location.pathname !== '/signup') {
        location.href = '/login';
      }
    } else if (status === 401 && isAuthEndpoint) {
      // Auth-endpoint 401 — show the real message (e.g. "Invalid credentials")
      // but DON'T wipe storage or redirect. Exception: stay silent on the
      // /auth/me boot check, which legitimately 401s for logged-out users.
      if (!url.includes('/auth/me')) {
        toast.error(message);
      }
    } else if (status >= 400) {
      toast.error(message);
    } else if (!err.response) {
      // Network error / timeout (common on Render cold starts).
      toast.error('Network issue — the server may be waking up. Please try again.');
    }

    return Promise.reject(Object.assign(new Error(message), {
      status,
      code: err.code,
    }));
  }
);

export default api;
