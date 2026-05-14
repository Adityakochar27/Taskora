import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 45000, // generous - Render free tier cold starts can take 30-60s
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

    const isAuthEndpoint = url.includes('/auth/');
    const hadToken = !!localStorage.getItem('tf_token');
    const onPublicPage =
      location.pathname === '/login' || location.pathname === '/signup';

    if (status === 401) {
      if (isAuthEndpoint) {
        // Auth-endpoint 401 is normal flow (wrong password, signup validation,
        // cold-start FCM hiccup). Show the real message, never redirect.
        // Stay silent on /auth/me - it legitimately 401s for logged-out users.
        if (!url.includes('/auth/me')) toast.error(message);
      } else if (!hadToken || onPublicPage) {
        // A protected endpoint 401'd but the user was never logged in (e.g.
        // the signup page fetching the department list). This is expected -
        // do NOT show "session expired", do NOT redirect. Just fail quietly.
      } else {
        // A genuine expired/invalid session: had a token, protected endpoint,
        // not on a public page.
        localStorage.removeItem('tf_token');
        localStorage.removeItem('tf_user');
        toast.error('Session expired. Please log in again.');
        location.href = '/login';
      }
    } else if (status >= 400) {
      toast.error(message);
    } else if (!err.response) {
      toast.error('Network issue - the server may be waking up. Please try again.');
    }

    return Promise.reject(Object.assign(new Error(message), {
      status,
      code: err.code,
    }));
  }
);

export default api;
