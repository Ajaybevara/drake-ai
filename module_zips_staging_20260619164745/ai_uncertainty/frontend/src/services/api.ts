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

export const productionApi = {
  sample: () => api.get('/production/sample'),
  analyze: (file?: File) => {
    const fd = new FormData()
    if (file) fd.append('file', file)
    return api.post('/production/analyze', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ── Petrophysics ─────────────────────────────────────────────────────────
export const petrophysicsApi = {
  predictionBundle: (wellId: number) => api.get(`/petrophysics/well/${wellId}/prediction-bundle`),
  uncertainty: (wellId: number, params?: any) => api.post(`/petrophysics/well/${wellId}/uncertainty`, params || {}),
  loadCrossplotDemo: () => api.post('/petrophysics/crossplot/load-demo'),
  loadCrossplotFromPetroSession: (sessionId: string) => api.post('/petrophysics/crossplot/load-petro-session', { session_id: sessionId }),
  uploadCrossplotLas: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/petrophysics/crossplot/upload-las', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  generateCrossplot: (params: any) => api.post('/petrophysics/crossplot/generate', params),
  loadHistogramDemo: () => api.post('/petrophysics/histogram/load-demo'),
  loadHistogramFromPetroSession: (sessionId: string) => api.post('/petrophysics/histogram/load-petro-session', { session_id: sessionId }),
  uploadHistogramLas: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/petrophysics/histogram/upload-las', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  generateHistogram: (params: any) => api.post('/petrophysics/histogram/generate', params),
  loadPetroLasDemo: () => api.post('/petrophysics/las/load-demo'),
  uploadPetroLas: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/petrophysics/las/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  generatePetroLogViewer: (params: any) => api.post('/petrophysics/las/log-viewer', params),
  analyzeMissingLog: (sessionId: string) => api.post('/petrophysics/missing-log/analyze', { session_id: sessionId }),
  predictMissingLog: (params: any) => api.post('/petrophysics/missing-log/predict', params),
  generatePetroPrediction: (params: string | any) => api.post('/petrophysics/las/prediction', typeof params === 'string' ? { session_id: params } : params),
  generatePetroUncertainty: (params: any) => api.post('/petrophysics/las/uncertainty', params),
  runAutoSplice: (files: File[]) => {
    const fd = new FormData()
    files.forEach(file => fd.append('files', file))
    return api.post('/petrophysics/autosplice/run', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  autospliceDownloadUrl: (path: string) => `${API_URL}${path}`,
  uploadToolboxLog: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/petrophysics/toolbox/upload-log', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  loadToolboxFromPetroSession: (sessionId: string) => api.post('/petrophysics/toolbox/load-petro-session', { session_id: sessionId }),
  runToolboxFacies: (params: any) => api.post('/petrophysics/toolbox/facies/run', params),
  uploadToolboxTops: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/petrophysics/toolbox/upload-tops', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  runToolboxFormationTops: (params: any) => api.post('/petrophysics/toolbox/formation-tops/run', params),
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
    view?: string
    selected_inline?: number
    selected_crossline?: number
    amplitude_range?: string
    color_scale?: string
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
    view?: string
    selected_inline?: number
    selected_crossline?: number
    amplitude_range?: string
    color_scale?: string
  }) => api.post('/seismic/low-frequency-enhancement', params),
}

export const ccusApi = {
  loadSample: () => api.post('/ccus/load-sample'),
  uploadLas: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/ccus/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  calculate: (params: any) => api.post('/ccus/calculate', params),
  exportUrl: (sessionId: string) => `${API_URL}/api/ccus/export/${sessionId}`,
}

export const geothermalApi = {
  uploadLas: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/geothermal/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  loadSample: () => api.post('/geothermal/sample'),
  exportCsvUrl: (sessionId: string) => `${API_URL}/api/geothermal/export/${sessionId}/results.csv`,
  exportJsonUrl: (sessionId: string) => `${API_URL}/api/geothermal/export/${sessionId}/interpretation.json`,
  exportSectionUrl: (sessionId: string, section: string, fmt: 'csv' | 'json') => `${API_URL}/api/geothermal/export/${sessionId}/${section}.${fmt}`,
  heatFlowMapUrl: (sessionId: string) => `${API_URL}/api/geothermal/heat-flow-map/${sessionId}.png`,
}

export const localProjectsApi = {
  platform: () => api.get('/projects/platform'),
  locations: () => api.get('/projects/locations'),
  create: (data: any) => api.post('/projects/create', data),
  current: () => api.get('/projects/current'),
  list: (locationKey?: string) => api.get('/projects/registry', { params: { location_key: locationKey } }),
  open: (projectPath: string) => api.post('/projects/open', { project_path: projectPath }),
  files: (projectId?: string, moduleName?: string) => api.get('/projects/files', { params: { project_id: projectId, module_name: moduleName } }),
  results: (projectId?: string) => api.get('/projects/results', { params: { project_id: projectId } }),
  history: (projectId?: string) => api.get('/projects/history', { params: { project_id: projectId } }),
  uploadFiles: (projectId: string | undefined, files: File[]) => {
    const fd = new FormData()
    if (projectId) fd.append('project_id', projectId)
    files.forEach(file => fd.append('files', file))
    return api.post('/projects/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  saveResult: (data: any) => api.post('/projects/save-result', data),
  saveExport: (data: any) => api.post('/projects/save-export', data),
  setStoragePath: (data: any) => api.post('/projects/set-storage-path', data),
  fileDownloadUrl: (fileId: string, projectId?: string) => `${API_URL}/api/projects/files/${fileId}/download${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`,
  save: (data: { location_key: string; project: any; file_name?: string }) => api.post('/projects/save-result', {
    module_name: 'Platform',
    prediction_name: data.file_name || 'project_snapshot',
    extension: 'json',
    result_payload: data.project,
  }),
  uploadFile: (file: File) => {
    const fd = new FormData()
    fd.append('files', file)
    return api.post('/projects/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export default api
