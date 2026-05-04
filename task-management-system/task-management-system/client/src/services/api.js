import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 20000,
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

    if (status === 401) {
      localStorage.removeItem('tf_token');
      localStorage.removeItem('tf_user');
      // Avoid showing toast on /auth/me bootstrap.
      if (!err.config?.url?.includes('/auth/me')) {
        toast.error('Session expired. Please log in again.');
        if (location.pathname !== '/login') location.href = '/login';
      }
    } else if (status >= 400) {
      toast.error(message);
    }
    return Promise.reject(new Error(message));
  }
);

export default api;
