import api from './api';

export const userService = {
  list: (params = {}) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.put(`/users/${id}`, payload),
  remove: (id) => api.delete(`/users/${id}`),

  /**
   * Picker — used by assignment / chat dropdowns.
   * { all: false } → just the requester's contacts (default)
   * { all: true } → full org, filtered by RBAC server-side
   */
  picker: (params = {}) => api.get('/users/picker', { params }),

  // Contacts (per-user "people I work with" list)
  listContacts: (userId) => api.get(`/users/${userId}/contacts`),
  addContacts: (userId, contactIds) =>
    api.post(`/users/${userId}/contacts`, { contactIds }),
  removeContact: (userId, contactId) =>
    api.delete(`/users/${userId}/contacts/${contactId}`),
};

export const teamService = {
  list: (params = {}) => api.get('/teams', { params }),
  get: (id) => api.get(`/teams/${id}`),
  create: (payload) => api.post('/teams', payload),
  update: (id, payload) => api.put(`/teams/${id}`, payload),
  remove: (id) => api.delete(`/teams/${id}`),
};

export const departmentService = {
  list: () => api.get('/departments'),
  get: (id) => api.get(`/departments/${id}`),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.put(`/departments/${id}`, payload),
  remove: (id) => api.delete(`/departments/${id}`),
};

export const dashboardService = {
  summary: () => api.get('/dashboard/summary'),
  productivity: (days = 30) =>
    api.get('/dashboard/productivity', { params: { days } }),
  activity: (limit = 50) =>
    api.get('/dashboard/activity', { params: { limit } }),
};

export const notificationService = {
  list: (params = {}) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
};
