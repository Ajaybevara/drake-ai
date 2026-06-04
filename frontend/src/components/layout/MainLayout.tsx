import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '../../store'
import { projectsApi, wellsApi, curvesApi, filesApi, aiApi } from '../../services/api'
import TopBar from './TopBar'
import Ribbon from './Ribbon'
import Sidebar from './Sidebar'
import Workspace from './Workspace'
import RightPanel from './RightPanel'

export default function MainLayout() {
  const { activeProject, activeWell, setProjects, setActiveProject, setWells, setActiveWell, setCurves, setFiles, setAIJobs, theme } = useStore()
  const isLight = theme === 'light'

  // Load projects on mount
  useEffect(() => {
    projectsApi.list().then(res => {
      const projects = res.data
      setProjects(projects)
      if (projects.length > 0) {
        setActiveProject(projects[0])
      }
    }).catch(() => toast.error('Failed to load projects'))
  }, [])

  // Load wells when project changes
  useEffect(() => {
    if (!activeProject) return
    wellsApi.list(activeProject.id).then(res => {
      const wells = res.data
      setWells(wells)
      if (wells.length > 0) setActiveWell(wells[0])
    }).catch(() => {})
  }, [activeProject?.id])

  // Load curves + files + AI jobs when well changes
  useEffect(() => {
    if (!activeWell) return
    curvesApi.list(activeWell.id).then(res => setCurves(res.data)).catch(() => {})
    filesApi.list(activeWell.id).then(res => setFiles(res.data)).catch(() => {})
    aiApi.list(activeWell.id).then(res => setAIJobs(res.data)).catch(() => {})
  }, [activeWell?.id])

  return (
    <div data-theme={theme} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: isLight ? '#EEF2F7' : '#070B12' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <Ribbon />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <Workspace />
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
