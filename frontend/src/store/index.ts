import { create } from 'zustand'

interface User {
  id: number
  email: string
  full_name: string
  role: string
  avatar_initials: string
}

interface Project { id: number; name: string; well_count: number }
interface Well {
  id: number; project_id: number; name: string; api_number?: string
  operator?: string; field?: string; county?: string; state?: string
  kb_elevation?: number; total_depth?: number; top_depth?: number
  base_depth?: number; depth_uom: string; status: string
  curve_count: number; file_count: number; formation_tops: FormationTop[]
  qc_score?: number; reservoir_zones?: any[]
}
interface FormationTop {
  id: number; formation_name: string; tvd_ft?: number; md_ft?: number
  is_ai_detected: boolean; confidence?: number; color_hex: string
}
interface Curve {
  id: number; well_id: number; mnemonic: string; unit?: string
  description?: string; min_value?: number; max_value?: number
  mean_value?: number; null_count: number; is_predicted: boolean
}
interface AIJob {
  id: number; well_id: number; job_type: string; status: string
  progress: number; accuracy?: number; confidence?: string
  model_name: string; predicted_curves: string[]; result?: any
  error_message?: string; created_at?: string; completed_at?: string
}
interface WellFile {
  id: number; filename: string; file_type: string
  file_size_mb: number; is_processed: boolean
  curve_count: number; depth_start?: number; depth_end?: number
  uploaded_at?: string
}

export type ProjectFileStatus = 'Uploaded' | 'Parsed' | 'Failed' | 'Ready'

export interface ProjectFile {
  id: string
  projectId: string
  name: string
  type: string
  size: number
  uploadedAt: string
  status: ProjectFileStatus
  category: 'las' | 'reports' | 'images' | 'tables' | 'digitizer' | 'seismic'
  compatibility: string[]
  storagePath?: string
  backendReady?: boolean
}

export interface LocalProject {
  id: string
  name: string
  createdAt: string
  lastOpenedAt: string
  files: ProjectFile[]
  selectedWells: string[]
  moduleState: Record<string, any>
  outputs: Array<{ id: string; module: string; name: string; type: string; createdAt: string }>
  activity: Array<{ id: string; text: string; createdAt: string }>
}

export interface DrakeProjectDocument {
  schemaVersion: 1
  app: 'Drake AI Enterprise Platform'
  savedAt: string
  project: LocalProject
}

const readLocalProjects = (): LocalProject[] => []
const writeLocalProjects = (_projects: LocalProject[]) => {}

const classifyProjectFile = (file: File): Pick<ProjectFile, 'category' | 'compatibility' | 'status'> => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.las')) return { category: 'las', compatibility: ['Petrophysics', 'CCUS'], status: 'Parsed' }
  if (name.endsWith('.sgy') || name.endsWith('.segy') || name.endsWith('.npy')) return { category: 'seismic', compatibility: ['Seismic'], status: 'Ready' }
  if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) return { category: 'reports', compatibility: ['CCUS', 'Digitizer', 'Reports'], status: 'Ready' }
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.tif') || name.endsWith('.tiff')) return { category: 'images', compatibility: ['Digitizer'], status: 'Ready' }
  if (name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx')) return { category: 'tables', compatibility: ['Production', 'CCUS', 'Reports'], status: 'Ready' }
  return { category: 'digitizer', compatibility: ['Reports'], status: 'Uploaded' }
}

interface AppState {
  // Auth
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void

  // Projects
  projects: Project[]
  activeProject: Project | null
  setProjects: (p: Project[]) => void
  setActiveProject: (p: Project) => void

  // Wells
  wells: Well[]
  activeWell: Well | null
  setWells: (w: Well[]) => void
  setActiveWell: (w: Well | null) => void

  // Curves
  curves: Curve[]
  setCurves: (c: Curve[]) => void

  // Files
  files: WellFile[]
  setFiles: (f: WellFile[]) => void

  // AI Jobs
  aiJobs: AIJob[]
  setAIJobs: (j: AIJob[]) => void
  upsertAIJob: (j: AIJob) => void

  // UI State
  activeTab: string
  setActiveTab: (t: string) => void
  theme: 'dark' | 'light'
  toggleTheme: () => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Local project-first workflow
  localProjects: LocalProject[]
  activeLocalProject: LocalProject | null
  activeProjectFileHandle: any | null
  activeProjectFileName: string | null
  projectDirty: boolean
  createLocalProject: (name: string) => LocalProject
  openLocalProject: (id: string) => void
  setActiveProjectFileHandle: (handle: any | null, fileName?: string | null) => void
  setActiveLocalProjectDocument: (project: LocalProject, handle?: any | null, fileName?: string | null) => void
  markProjectSaved: () => void
  addProjectFiles: (projectId: string, files: File[]) => void
  addProjectFileRecords: (projectId: string, files: ProjectFile[]) => void
  deleteProjectFile: (projectId: string, fileId: string) => void
  importLocalProject: (project: LocalProject) => LocalProject
  updateProjectModuleState: (projectId: string, moduleKey: string, patch: Record<string, any>) => void
  addProjectOutput: (projectId: string, output: { module: string; name: string; type: string }) => void
}

export const useStore = create<AppState>((set) => ({
  // Auth
  user: localStorage.getItem('drake_user') ? JSON.parse(localStorage.getItem('drake_user')!) : null,
  token: localStorage.getItem('drake_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('drake_token', token)
    localStorage.setItem('drake_user', JSON.stringify(user))
    set({ user, token })
  },
  logout: () => {
    localStorage.removeItem('drake_token')
    localStorage.removeItem('drake_user')
    set({ user: null, token: null, activeProject: null, activeWell: null })
  },

  // Projects
  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => set({ activeProject }),

  // Wells
  wells: [],
  activeWell: null,
  setWells: (wells) => set({ wells }),
  setActiveWell: (activeWell) => set({ activeWell }),

  // Curves
  curves: [],
  setCurves: (curves) => set({ curves }),

  // Files
  files: [],
  setFiles: (files) => set({ files }),

  // AI Jobs
  aiJobs: [],
  setAIJobs: (aiJobs) => set({ aiJobs }),
  upsertAIJob: (job) => set((state) => {
    const existing = state.aiJobs.findIndex(j => j.id === job.id)
    if (existing >= 0) {
      const updated = [...state.aiJobs]
      updated[existing] = job
      return { aiJobs: updated }
    }
    return { aiJobs: [job, ...state.aiJobs] }
  }),

  // UI
  activeTab: 'Log Viewer',
  setActiveTab: (activeTab) => set({ activeTab }),
  theme: (localStorage.getItem('drake_theme') as 'dark' | 'light') || 'dark',
  toggleTheme: () => set((s) => {
    const theme = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('drake_theme', theme)
    return { theme }
  }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Local project-first workflow
  localProjects: readLocalProjects(),
  activeLocalProject: null,
  activeProjectFileHandle: null,
  activeProjectFileName: null,
  projectDirty: false,
  createLocalProject: (name) => {
    const now = new Date().toISOString()
    const project: LocalProject = {
      id: `project-${Date.now()}`,
      name,
      createdAt: now,
      lastOpenedAt: now,
      files: [],
      selectedWells: [],
      moduleState: {},
      outputs: [],
      activity: [{ id: `activity-${Date.now()}`, text: `Project ${name} created`, createdAt: now }],
    }
    set((state) => {
      const localProjects = [project, ...state.localProjects]
      return { localProjects, activeLocalProject: project, projectDirty: true }
    })
    return project
  },
  openLocalProject: (id) => set((state) => {
    const now = new Date().toISOString()
    const localProjects = state.localProjects.map(project =>
      project.id === id ? { ...project, lastOpenedAt: now } : project
    )
    const activeLocalProject = localProjects.find(project => project.id === id) || null
    return { localProjects, activeLocalProject }
  }),
  setActiveProjectFileHandle: (activeProjectFileHandle, fileName = null) => set({
    activeProjectFileHandle,
    activeProjectFileName: fileName || activeProjectFileHandle?.name || null,
  }),
  setActiveLocalProjectDocument: (project, handle = null, fileName = null) => set((state) => {
    const localProjects = [project, ...state.localProjects.filter(item => item.id !== project.id)]
    return {
      localProjects,
      activeLocalProject: project,
      activeProjectFileHandle: handle,
      activeProjectFileName: fileName || handle?.name || `${project.name}.drake`,
      projectDirty: false,
    }
  }),
  markProjectSaved: () => set({ projectDirty: false }),
  addProjectFiles: (projectId, files) => set((state) => {
    const now = new Date().toISOString()
    const newFiles: ProjectFile[] = files.map(file => {
      const classified = classifyProjectFile(file)
      return {
        id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        projectId,
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || file.type || 'FILE',
        size: file.size,
        uploadedAt: now,
        ...classified,
      }
    })
    const localProjects = state.localProjects.map(project => {
      if (project.id !== projectId) return project
      return {
        ...project,
        files: [...newFiles, ...project.files],
        activity: [
          { id: `activity-${Date.now()}`, text: `${newFiles.length} file(s) uploaded to repository`, createdAt: now },
          ...project.activity,
        ],
      }
    })
    const activeLocalProject = localProjects.find(project => project.id === projectId) || state.activeLocalProject
    return { localProjects, activeLocalProject, projectDirty: true }
  }),
  addProjectFileRecords: (projectId, files) => set((state) => {
    const now = new Date().toISOString()
    const records = files.map(file => ({ ...file, projectId, uploadedAt: file.uploadedAt || now }))
    const localProjects = state.localProjects.map(project => {
      if (project.id !== projectId) return project
      return {
        ...project,
        files: [...records, ...project.files],
        activity: [
          { id: `activity-${Date.now()}`, text: `${records.length} file(s) copied to local project storage`, createdAt: now },
          ...project.activity,
        ],
      }
    })
    const activeLocalProject = localProjects.find(project => project.id === projectId) || state.activeLocalProject
    return { localProjects, activeLocalProject, projectDirty: true }
  }),
  deleteProjectFile: (projectId, fileId) => set((state) => {
    const localProjects = state.localProjects.map(project =>
      project.id === projectId ? { ...project, files: project.files.filter(file => file.id !== fileId) } : project
    )
    const activeLocalProject = localProjects.find(project => project.id === projectId) || state.activeLocalProject
    return { localProjects, activeLocalProject, projectDirty: true }
  }),
  importLocalProject: (incomingProject) => {
    const now = new Date().toISOString()
    const project: LocalProject = {
      ...incomingProject,
      id: incomingProject.id || `project-${Date.now()}`,
      lastOpenedAt: now,
      files: incomingProject.files || [],
      selectedWells: incomingProject.selectedWells || [],
      moduleState: incomingProject.moduleState || {},
      outputs: incomingProject.outputs || [],
      activity: [
        { id: `activity-${Date.now()}`, text: `Project ${incomingProject.name} opened from local storage`, createdAt: now },
        ...(incomingProject.activity || []),
      ],
    }
    set((state) => {
      const localProjects = [project, ...state.localProjects.filter(item => item.id !== project.id)]
      return { localProjects, activeLocalProject: project, projectDirty: true }
    })
    return project
  },
  updateProjectModuleState: (projectId, moduleKey, patch) => set((state) => {
    const localProjects = state.localProjects.map(project => {
      if (project.id !== projectId) return project
      return {
        ...project,
        moduleState: {
          ...project.moduleState,
          [moduleKey]: { ...(project.moduleState[moduleKey] || {}), ...patch },
        },
      }
    })
    const activeLocalProject = localProjects.find(project => project.id === projectId) || state.activeLocalProject
    return { localProjects, activeLocalProject, projectDirty: true }
  }),
  addProjectOutput: (projectId, output) => set((state) => {
    const now = new Date().toISOString()
    const localProjects = state.localProjects.map(project => {
      if (project.id !== projectId) return project
      return {
        ...project,
        outputs: [{ id: `output-${Date.now()}`, createdAt: now, ...output }, ...project.outputs],
        activity: [{ id: `activity-${Date.now()}`, text: `${output.name} generated`, createdAt: now }, ...project.activity],
      }
    })
    const activeLocalProject = localProjects.find(project => project.id === projectId) || state.activeLocalProject
    return { localProjects, activeLocalProject, projectDirty: true }
  }),
}))
