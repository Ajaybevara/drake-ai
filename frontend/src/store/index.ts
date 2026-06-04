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
  category: 'las' | 'reports' | 'images' | 'tables' | 'digitizer'
  compatibility: string[]
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

const LOCAL_PROJECTS_KEY = 'drake_local_projects'
const ACTIVE_LOCAL_PROJECT_KEY = 'drake_active_local_project'

const readLocalProjects = (): LocalProject[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || '[]')
  } catch {
    return []
  }
}

const writeLocalProjects = (projects: LocalProject[]) => {
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects))
}

const classifyProjectFile = (file: File): Pick<ProjectFile, 'category' | 'compatibility' | 'status'> => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.las')) return { category: 'las', compatibility: ['Petrophysics', 'CCUS'], status: 'Parsed' }
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
  createLocalProject: (name: string) => LocalProject
  openLocalProject: (id: string) => void
  addProjectFiles: (projectId: string, files: File[]) => void
  deleteProjectFile: (projectId: string, fileId: string) => void
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
  activeLocalProject: (() => {
    const projects = readLocalProjects()
    const activeId = localStorage.getItem(ACTIVE_LOCAL_PROJECT_KEY)
    return projects.find(p => p.id === activeId) || null
  })(),
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
      writeLocalProjects(localProjects)
      localStorage.setItem(ACTIVE_LOCAL_PROJECT_KEY, project.id)
      return { localProjects, activeLocalProject: project }
    })
    return project
  },
  openLocalProject: (id) => set((state) => {
    const now = new Date().toISOString()
    const localProjects = state.localProjects.map(project =>
      project.id === id ? { ...project, lastOpenedAt: now } : project
    )
    const activeLocalProject = localProjects.find(project => project.id === id) || null
    writeLocalProjects(localProjects)
    if (activeLocalProject) localStorage.setItem(ACTIVE_LOCAL_PROJECT_KEY, id)
    return { localProjects, activeLocalProject }
  }),
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
    writeLocalProjects(localProjects)
    return { localProjects, activeLocalProject }
  }),
  deleteProjectFile: (projectId, fileId) => set((state) => {
    const localProjects = state.localProjects.map(project =>
      project.id === projectId ? { ...project, files: project.files.filter(file => file.id !== fileId) } : project
    )
    const activeLocalProject = localProjects.find(project => project.id === projectId) || state.activeLocalProject
    writeLocalProjects(localProjects)
    return { localProjects, activeLocalProject }
  }),
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
    writeLocalProjects(localProjects)
    return { localProjects, activeLocalProject }
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
    writeLocalProjects(localProjects)
    return { localProjects, activeLocalProject }
  }),
}))
