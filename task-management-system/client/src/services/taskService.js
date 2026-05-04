import api from './api';

export const taskService = {
  list: (params = {}) => api.get('/tasks', { params }),
  get: (id) => api.get(`/tasks/${id}`),
  create: (payload) => api.post('/tasks', payload),
  update: (id, payload) => api.put(`/tasks/${id}`, payload),
  remove: (id) => api.delete(`/tasks/${id}`),
  comment: (id, text) => api.post(`/tasks/${id}/comments`, { text }),
  uploadAttachment: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/tasks/${id}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
