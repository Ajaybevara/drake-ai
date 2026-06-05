import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8002'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('drake_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('drake_token')
      localStorage.removeItem('drake_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me:       () => api.get('/auth/me'),
}

// ── Projects ──────────────────────────────────────────────────────────────
export const projectsApi = {
  list:   () => api.get('/projects/'),
  get:    (id: number) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects/', data),
  delete: (id: number) => api.delete(`/projects/${id}`),
}

// ── Wells ─────────────────────────────────────────────────────────────────
export const wellsApi = {
  list:   (projectId: number) => api.get(`/wells/project/${projectId}`),
  get:    (id: number) => api.get(`/wells/${id}`),
  create: (data: any) => api.post('/wells/', data),
  delete: (id: number) => api.delete(`/wells/${id}`),
}

// ── Curves ────────────────────────────────────────────────────────────────
export const curvesApi = {
  list:       (wellId: number) => api.get(`/curves/well/${wellId}`),
  getData:    (curveId: number) => api.get(`/curves/${curveId}/data`),
  getByMnem:  (wellId: number, mnem: string) => api.get(`/curves/well/${wellId}/mnemonic/${mnem}`),
}

// ── Files ─────────────────────────────────────────────────────────────────
export const filesApi = {
  list:   (wellId: number) => api.get(`/files/well/${wellId}`),
  upload: (wellId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/files/upload/${wellId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (fileId: number) => api.delete(`/files/${fileId}`),
}

// ── AI Jobs ───────────────────────────────────────────────────────────────
export const aiApi = {
  run:    (wellId: number, jobType: string, params?: any) =>
    api.post('/ai/run', { well_id: wellId, job_type: jobType, parameters: params || {} }),
  list:   (wellId: number) => api.get(`/ai/well/${wellId}`),
  get:    (jobId: number)  => api.get(`/ai/${jobId}`),
  delete: (jobId: number)  => api.delete(`/ai/${jobId}`),
}

// ── GPT ───────────────────────────────────────────────────────────────────
export const gptApi = {
  chat: (wellId: number, messages: { role: string; content: string }[]) =>
    api.post('/gpt/chat', { well_id: wellId, messages }),
}

// ── Reports ───────────────────────────────────────────────────────────────
export const reportsApi = {
  list:     (wellId: number) => api.get(`/reports/well/${wellId}`),
  generate: (wellId: number, type: string) => api.post(`/reports/generate?well_id=${wellId}&report_type=${type}`),
}

// ── Petrophysics ─────────────────────────────────────────────────────────
export const petrophysicsApi = {
  predictionBundle: (wellId: number) => api.get(`/petrophysics/well/${wellId}/prediction-bundle`),
  uncertainty: (wellId: number, params?: any) => api.post(`/petrophysics/well/${wellId}/uncertainty`, params || {}),
}

// Seismic
export const seismicApi = {
  uploadFile: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/seismic/files/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  inspect: (params: {
    file_name: string
    storage_path?: string
    freq_low?: number
    freq_high?: number
    gain?: number
    sample_interval_ms?: number
    workflow?: string
    dimension?: string
    dl_epochs?: number
    dl_batch?: number
  }) => api.post('/seismic/inspect', params),
  lowFrequencyEnhancement: (params: {
    file_name: string
    storage_path?: string
    freq_low?: number
    freq_high?: number
    gain?: number
    sample_interval_ms?: number
    workflow?: string
    dimension?: string
    dl_epochs?: number
    dl_batch?: number
  }) => api.post('/seismic/low-frequency-enhancement', params),
}

export const localProjectsApi = {
  locations: () => api.get('/local-projects/locations'),
  save: (data: { location_key: string; project: any; file_name?: string }) => api.post('/local-projects/save', data),
  list: (locationKey: string) => api.get(`/local-projects/list?location_key=${encodeURIComponent(locationKey)}`),
  open: (path: string) => api.post('/local-projects/open', { path }),
  uploadFile: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/local-projects/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export default api
