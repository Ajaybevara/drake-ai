import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminPanelPage from './pages/AdminPanelPage'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './pages/DashboardPage'
import PlatformLandingPage from './pages/PlatformLandingPage'
import ProjectsPage from './pages/ProjectsPage'
import DataManagementPage from './pages/DataManagementPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import UIOnlyModulePage from './pages/UIOnlyModulePage'
import FaciesClassificationPage from './pages/FaciesClassificationPage'
import FormationTopsPage from './pages/FormationTopsPage'
import GeothermalPage from './pages/GeothermalPage'
import LockedModulePage from './pages/LockedModulePage'
import { useStore } from './store'
import { canAccessPath } from './utils/accessControl'

const PORTAL_MODE = import.meta.env.VITE_PORTAL_MODE || 'combined'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, staleTime: 30000 } },
})

function PrivateRoute({ children, loginPath = '/login' }: { children: React.ReactNode; loginPath?: string }) {
  const token = useStore(s => s.token)
  return token ? <>{children}</> : <Navigate to={loginPath} replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = useStore(s => s.token)
  const user = useStore(s => s.user)
  if (!token || !user) return <Navigate to="/admin-login" replace />
  if (user.role !== 'admin') return <Navigate to="/admin-login" replace />
  return <>{children}</>
}

function AccessRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const user = useStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (!canAccessPath(user.role, user.accessModules, location.pathname)) return <LockedModulePage />
  return <>{children}</>
}

const userRoutes = [
  { path: '/login', element: <LoginPage /> },
  ...(PORTAL_MODE === 'combined' ? [{ path: '/admin-login', element: <AdminLoginPage /> }] : []),
  { path: '/register', element: <Navigate to="/login" replace /> },
  ...(PORTAL_MODE === 'combined' ? [{
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminPanelPage />
      </AdminRoute>
    ),
  }] : []),
  {
    path: '/',
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <AccessRoute><PlatformLandingPage /></AccessRoute> },
      { path: 'dashboard', element: <AccessRoute><DashboardPage /></AccessRoute> },
      { path: 'projects', element: <AccessRoute><ProjectsPage /></AccessRoute> },
      { path: 'data-management', element: <AccessRoute><DataManagementPage /></AccessRoute> },
      { path: 'analytics/reports', element: <AccessRoute><ReportsPage /></AccessRoute> },
      { path: 'settings', element: <AccessRoute><SettingsPage /></AccessRoute> },

      { path: 'petrophysics/log-visualization', element: <AccessRoute><UIOnlyModulePage title="Log Visualization" kind="logs" /></AccessRoute> },
      { path: 'petrophysics/missing-log-prediction', element: <AccessRoute><UIOnlyModulePage title="Missing Log Prediction" kind="logs" accent="#8B5CF6" /></AccessRoute> },
      { path: 'petrophysics/ai-facies-classification', element: <AccessRoute><FaciesClassificationPage /></AccessRoute> },
      { path: 'petrophysics/ai-formation-tops', element: <AccessRoute><FormationTopsPage /></AccessRoute> },
      { path: 'petrophysics/ai-parameter-prediction', element: <AccessRoute><UIOnlyModulePage title="AI Parameter Prediction" kind="logs" accent="#DA2626" /></AccessRoute> },
      { path: 'petrophysics/ai-uncertainty', element: <AccessRoute><UIOnlyModulePage title="AI Uncertainty" kind="logs" accent="#EF4444" /></AccessRoute> },
      { path: 'petrophysics/auto-splicer', element: <AccessRoute><UIOnlyModulePage title="Auto Splicer" kind="logs" accent="#10B981" /></AccessRoute> },
      { path: 'petrophysics/crossplot', element: <AccessRoute><UIOnlyModulePage title="Crossplot" kind="logs" accent="#A78BFA" /></AccessRoute> },
      { path: 'petrophysics/histogram', element: <AccessRoute><UIOnlyModulePage title="Histogram" kind="logs" accent="#F59E0B" /></AccessRoute> },

      { path: 'seismic/frequency-enhancer', element: <AccessRoute><UIOnlyModulePage title="Seismic Frequency Enhancer" kind="seismic" accent="#8B5CF6" /></AccessRoute> },

      { path: 'production/intelligence', element: <AccessRoute><UIOnlyModulePage title="Production Intelligence" kind="production" accent="#10B981" /></AccessRoute> },
      { path: 'production/optimization', element: <Navigate to="/production/intelligence" replace /> },
      { path: 'production/ai-artificial-lift', element: <Navigate to="/production/intelligence" replace /> },

      { path: 'ccus/ai-preliminary-screening', element: <AccessRoute><UIOnlyModulePage title="AI Preliminary Screening Using Well Logs" kind="ccus" accent="#10B981" /></AccessRoute> },
      { path: 'geothermal/log-based-screening', element: <AccessRoute><GeothermalPage /></AccessRoute> },

      { path: 'digitizer/drake-slm-gpt', element: <AccessRoute><UIOnlyModulePage title="Drake SLM/GPT" kind="digitizer" accent="#EF4444" /></AccessRoute> },
      { path: 'digitizer/drake-ocr', element: <AccessRoute><UIOnlyModulePage title="Drake OCR" kind="digitizer" accent="#DA2626" /></AccessRoute> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

const adminRoutes = [
  { path: '/admin-login', element: <AdminLoginPage /> },
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminPanelPage />
      </AdminRoute>
    ),
  },
  { path: '*', element: <Navigate to="/admin-login" replace /> },
]

const router = createBrowserRouter(PORTAL_MODE === 'admin' ? adminRoutes : userRoutes, {
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
