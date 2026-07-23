export type ModuleId =
  | 'log-visualization'
  | 'missing-log-prediction'
  | 'ai-facies-classification'
  | 'ai-formation-tops'
  | 'ai-parameter-prediction'
  | 'ai-uncertainty'
  | 'auto-splicer'
  | 'seismic-frequency-enhancer'
  | 'production-intelligence'
  | 'ccus-screening'
  | 'geothermal-screening'
  | 'well-log-digitizer'
  | 'drake-slm-gpt'
  | 'drake-ocr'

export interface AccessModule {
  id: ModuleId
  label: string
  group: string
  path: string
}

export const ADMIN_USERNAME = 'Drake6105'

export const ACCESS_MODULES: AccessModule[] = [
  { id: 'log-visualization', label: 'Log Visualization', group: 'Petrophysics', path: '/petrophysics/log-visualization' },
  { id: 'missing-log-prediction', label: 'Missing Log Prediction', group: 'Petrophysics', path: '/petrophysics/missing-log-prediction' },
  { id: 'ai-facies-classification', label: 'AI Facies Classification', group: 'Petrophysics', path: '/petrophysics/ai-facies-classification' },
  { id: 'ai-formation-tops', label: 'AI Formation Tops', group: 'Petrophysics', path: '/petrophysics/ai-formation-tops' },
  { id: 'ai-parameter-prediction', label: 'AI Parameter Prediction', group: 'Petrophysics', path: '/petrophysics/ai-parameter-prediction' },
  { id: 'ai-uncertainty', label: 'AI Uncertainty', group: 'Petrophysics', path: '/petrophysics/ai-uncertainty' },
  { id: 'auto-splicer', label: 'Auto Splicer', group: 'Petrophysics', path: '/petrophysics/auto-splicer' },
  { id: 'seismic-frequency-enhancer', label: 'Seismic Frequency Enhancer', group: 'Seismic', path: '/seismic/frequency-enhancer' },
  { id: 'production-intelligence', label: 'Production Intelligence', group: 'Production', path: '/production/intelligence' },
  { id: 'ccus-screening', label: 'AI Preliminary Screening Using Well Logs', group: 'CCUS', path: '/ccus/ai-preliminary-screening' },
  { id: 'geothermal-screening', label: 'Geothermal Log-Based Screening', group: 'Geothermal', path: '/geothermal/log-based-screening' },
  { id: 'well-log-digitizer', label: 'Well Log Digitizer', group: 'Drake AI Digitizer', path: '/digitizer/well-log-digitizer' },
  { id: 'drake-slm-gpt', label: 'Drake SLM/GPT', group: 'Drake AI Digitizer', path: '/digitizer/drake-slm-gpt' },
  { id: 'drake-ocr', label: 'Drake OCR', group: 'Drake AI Digitizer', path: '/digitizer/drake-ocr' },
]

export const ALL_MODULE_IDS = ACCESS_MODULES.map(module => module.id)

export function moduleForPath(pathname: string): ModuleId | null {
  if (pathname.startsWith('/petrophysics/log-visualization')) return 'log-visualization'
  if (pathname.startsWith('/petrophysics/missing-log-prediction')) return 'missing-log-prediction'
  if (pathname.startsWith('/petrophysics/ai-facies-classification')) return 'ai-facies-classification'
  if (pathname.startsWith('/petrophysics/ai-formation-tops')) return 'ai-formation-tops'
  if (pathname.startsWith('/petrophysics/ai-parameter-prediction')) return 'ai-parameter-prediction'
  if (pathname.startsWith('/petrophysics/ai-uncertainty')) return 'ai-uncertainty'
  if (pathname.startsWith('/petrophysics/auto-splicer')) return 'auto-splicer'
  if (pathname.startsWith('/petrophysics/crossplot')) return 'log-visualization'
  if (pathname.startsWith('/petrophysics/histogram')) return 'log-visualization'
  if (pathname.startsWith('/seismic/frequency-enhancer')) return 'seismic-frequency-enhancer'
  if (pathname.startsWith('/production')) return 'production-intelligence'
  if (pathname.startsWith('/ccus/ai-preliminary-screening')) return 'ccus-screening'
  if (pathname.startsWith('/geothermal/log-based-screening')) return 'geothermal-screening'
  if (pathname.startsWith('/digitizer/well-log-digitizer')) return 'well-log-digitizer'
  if (pathname.startsWith('/digitizer/drake-slm-gpt')) return 'drake-slm-gpt'
  if (pathname.startsWith('/digitizer/drake-ocr')) return 'drake-ocr'
  return null
}

export function canAccessPath(role: string | undefined, allowedModules: ModuleId[] | undefined, pathname: string) {
  if (role === 'admin') return true
  if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/projects') || pathname.startsWith('/data-management') || pathname.startsWith('/analytics/reports') || pathname.startsWith('/settings')) return true
  const moduleId = moduleForPath(pathname)
  return moduleId ? Boolean(allowedModules?.includes(moduleId)) : false
}

export function accessDeniedMessage(moduleLabel = 'this module') {
  return `${moduleLabel} is not open for your account. Once you subscribe to this module, contact admin to enable access.`
}

export function firstAllowedPath(role: string | undefined, allowedModules: ModuleId[] | undefined) {
  if (role === 'admin') return '/admin'
  const firstModule = ACCESS_MODULES.find(module => allowedModules?.includes(module.id))
  return firstModule?.path || '/dashboard'
}
