import { useEffect } from 'react'
import { useStore } from '../../store'
import TopBar from './TopBar'
import Ribbon from './Ribbon'
import Sidebar from './Sidebar'
import Workspace from './Workspace'
import FloatingChatbot from './FloatingChatbot'

export default function MainLayout() {
  const { setProjects, setActiveProject, setWells, setActiveWell, setCurves, setFiles, setAIJobs, theme } = useStore()
  const isLight = theme === 'light'

  useEffect(() => {
    const project = { id: 1, name: 'Permian Basin Study', well_count: 5 }
    const wells = [
      { id: 1, project_id: 1, name: 'SMITH_12H', api_number: '42-123-45678', field: 'Red Canyon', county: 'Lea', state: 'New Mexico', kb_elevation: 3455, total_depth: 12842, depth_uom: 'ft', status: 'Completed', curve_count: 28, file_count: 4, formation_tops: [], qc_score: 92, reservoir_zones: [{ name: 'A' }] },
      { id: 2, project_id: 1, name: 'JONES_07H', api_number: '42-223-45678', field: 'Red Canyon', county: 'Lea', state: 'New Mexico', kb_elevation: 3388, total_depth: 11940, depth_uom: 'ft', status: 'Active', curve_count: 24, file_count: 3, formation_tops: [], qc_score: 88, reservoir_zones: [] },
      { id: 3, project_id: 1, name: 'BROWN_15H', api_number: '42-323-45678', field: 'South Barrow', county: 'North Slope', state: 'Alaska', kb_elevation: 2540, total_depth: 10310, depth_uom: 'ft', status: 'QC Required', curve_count: 21, file_count: 2, formation_tops: [], qc_score: 76, reservoir_zones: [] },
    ]
    setProjects([project])
    setActiveProject(project)
    setWells(wells as any)
    setActiveWell(wells[0] as any)
    setCurves([
      { id: 1, well_id: 1, mnemonic: 'GR', unit: 'API', null_count: 0, is_predicted: false },
      { id: 2, well_id: 1, mnemonic: 'RHOB', unit: 'g/cc', null_count: 0, is_predicted: false },
      { id: 3, well_id: 1, mnemonic: 'NPHI', unit: 'v/v', null_count: 0, is_predicted: false },
      { id: 4, well_id: 1, mnemonic: 'RT', unit: 'ohm.m', null_count: 0, is_predicted: false },
    ] as any)
    setFiles([])
    setAIJobs([])
  }, [])

  return (
    <div data-theme={theme} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: isLight ? '#EEF2F7' : '#070B12' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <Ribbon />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <Workspace />
        </div>
      </div>
      <FloatingChatbot />
    </div>
  )
}
