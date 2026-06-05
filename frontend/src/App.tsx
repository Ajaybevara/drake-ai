import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './pages/LoginPage'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import DataManagementPage from './pages/DataManagementPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import UIOnlyModulePage from './pages/UIOnlyModulePage'
import { useStore } from './store'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, staleTime: 30000 } },
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
      { path: 'data-management', element: <DataManagementPage /> },
      { path: 'analytics/reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },

      { path: 'petrophysics/log-visualization', element: <UIOnlyModulePage title="Log Visualization" kind="logs" /> },
      { path: 'petrophysics/missing-log-prediction', element: <UIOnlyModulePage title="Missing Log Prediction" kind="logs" accent="#8B5CF6" /> },
      { path: 'petrophysics/ai-facies-classification', element: <UIOnlyModulePage title="AI Facies Classification" kind="logs" accent="#F59E0B" /> },
      { path: 'petrophysics/ai-formation-tops', element: <UIOnlyModulePage title="AI Formation Tops" kind="logs" accent="#10B981" /> },
      { path: 'petrophysics/ai-parameter-prediction', element: <UIOnlyModulePage title="AI Parameter Prediction" kind="logs" accent="#38BDF8" /> },
      { path: 'petrophysics/ai-uncertainty', element: <UIOnlyModulePage title="AI Uncertainty" kind="logs" accent="#EF4444" /> },
      { path: 'petrophysics/auto-splicer', element: <UIOnlyModulePage title="Auto Splicer" kind="logs" accent="#10B981" /> },
      { path: 'petrophysics/crossplot', element: <UIOnlyModulePage title="Crossplot" kind="logs" accent="#A78BFA" /> },
      { path: 'petrophysics/histogram', element: <UIOnlyModulePage title="Histogram" kind="logs" accent="#F59E0B" /> },

      { path: 'seismic/frequency-enhancer', element: <UIOnlyModulePage title="Seismic Frequency Enhancer" kind="seismic" accent="#8B5CF6" /> },

      { path: 'production/optimization', element: <UIOnlyModulePage title="Production Optimization" kind="production" accent="#10B981" /> },
      { path: 'production/ai-artificial-lift', element: <UIOnlyModulePage title="AI Artificial Lift" kind="production" accent="#38BDF8" /> },

      { path: 'ccus/ai-preliminary-screening', element: <UIOnlyModulePage title="AI Preliminary Screening Using Well Logs" kind="ccus" accent="#10B981" /> },

      { path: 'digitizer/drake-slm-gpt', element: <UIOnlyModulePage title="Drake SLM/GPT" kind="digitizer" accent="#EF4444" /> },
      { path: 'digitizer/drake-ocr', element: <UIOnlyModulePage title="Drake OCR" kind="digitizer" accent="#38BDF8" /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  future: { v7_relativeSplatPath: true },
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
