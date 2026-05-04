import api from './api';

export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (payload) => api.post('/auth/signup', payload),
  me: () => api.get('/auth/me'),
  registerFcm: (token) => api.post('/auth/fcm-token', { token }),
  removeFcm: (token) => api.post('/auth/fcm-token/remove', { token }),
};
