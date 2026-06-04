import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './pages/LoginPage'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import WellsPage from './pages/WellsPage'
import DataManagementPage from './pages/DataManagementPage'
import LogViewerPage from './pages/LogViewerPage'
import LogQCPage from './pages/LogQCPage'
import MissingLogAIPage from './pages/MissingLogAIPage'
import SingleWellMissingLogPage from './pages/SingleWellMissingLogPage'
import FaciesClassificationPage from './pages/FaciesClassificationPage'
import FormationTopsPage from './pages/FormationTopsPage'
import PorosityPermeabilityPage from './pages/PorosityPermeabilityPage'
import WaterSaturationPage from './pages/WaterSaturationPage'
import UncertaintyAnalysisPage from './pages/UncertaintyAnalysisPage'
import AutoSplicePage from './pages/AutoSplicePage'
import SeismicPage from './pages/SeismicPage'
import ProductionPage from './pages/ProductionPage'
import CCUSPage from './pages/CCUSPage'
import ReportsPage from './pages/ReportsPage'
import AIAssistantPage from './pages/AIAssistantPage'
import SettingsPage from './pages/SettingsPage'
import ProjectWorkspacePage from './pages/ProjectWorkspacePage'
import ProjectDataRepositoryPage from './pages/ProjectDataRepositoryPage'
import ProjectModulePage from './pages/ProjectModulePage'
import ProjectPetrophysicsToolPage from './pages/ProjectPetrophysicsToolPage'
import ProjectReportsPage from './pages/ProjectReportsPage'
import { useStore } from './store'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:projectId', element: <ProjectWorkspacePage /> },
      { path: 'projects/:projectId/data', element: <ProjectDataRepositoryPage /> },
      { path: 'projects/:projectId/petrophysics', element: <ProjectModulePage moduleKey="petrophysics" /> },
      { path: 'projects/:projectId/petrophysics/log-viewer', element: <ProjectPetrophysicsToolPage tool="log-viewer" /> },
      { path: 'projects/:projectId/petrophysics/log-qc', element: <ProjectPetrophysicsToolPage tool="log-qc" /> },
      { path: 'projects/:projectId/petrophysics/missing-log-prediction', element: <ProjectPetrophysicsToolPage tool="missing-log-prediction" /> },
      { path: 'projects/:projectId/petrophysics/facies-classification', element: <ProjectPetrophysicsToolPage tool="facies-classification" /> },
      { path: 'projects/:projectId/petrophysics/porosity-permeability', element: <ProjectPetrophysicsToolPage tool="porosity-permeability" /> },
      { path: 'projects/:projectId/petrophysics/water-saturation', element: <ProjectPetrophysicsToolPage tool="water-saturation" /> },
      { path: 'projects/:projectId/petrophysics/auto-splice', element: <ProjectPetrophysicsToolPage tool="auto-splice" /> },
      { path: 'projects/:projectId/seismic', element: <ProjectModulePage moduleKey="seismic" /> },
      { path: 'projects/:projectId/production', element: <ProjectModulePage moduleKey="production" /> },
      { path: 'projects/:projectId/ccus', element: <ProjectModulePage moduleKey="ccus" /> },
      { path: 'projects/:projectId/digitizer', element: <ProjectModulePage moduleKey="digitizer" /> },
      { path: 'projects/:projectId/reports', element: <ProjectReportsPage /> },
      { path: 'wells', element: <WellsPage /> },
      { path: 'data-management', element: <DataManagementPage /> },
      { path: 'petrophysics/log-viewer', element: <LogViewerPage /> },
      { path: 'petrophysics/log-qc', element: <LogQCPage /> },
      { path: 'petrophysics/missing-log-ai', element: <MissingLogAIPage /> },
      { path: 'petrophysics/missing-log-ai/single', element: <SingleWellMissingLogPage /> },
      { path: 'petrophysics/facies-classification', element: <FaciesClassificationPage /> },
      { path: 'petrophysics/formation-tops', element: <FormationTopsPage /> },
      { path: 'petrophysics/porosity-permeability', element: <PorosityPermeabilityPage /> },
      { path: 'petrophysics/water-saturation', element: <WaterSaturationPage /> },
      { path: 'petrophysics/uncertainty-analysis', element: <UncertaintyAnalysisPage /> },
      { path: 'petrophysics/auto-splice', element: <AutoSplicePage /> },
      { path: 'analytics/seismic', element: <SeismicPage /> },
      { path: 'analytics/production', element: <ProductionPage /> },
      { path: 'analytics/ccus', element: <CCUSPage /> },
      { path: 'analytics/reports', element: <ReportsPage /> },
      { path: 'analytics/ai-assistant', element: <AIAssistantPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  future: {
    v7_relativeSplatPath: true,
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1E293B', color: '#F1F5F9', border: '1px solid #334155', fontSize: '13px' },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
