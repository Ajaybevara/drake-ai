const DESTINATIONS: Record<string, string> = {
  '/seismic/frequency-enhancer': 'https://seismic.thedrake.ai/',
  '/digitizer/well-log-digitizer': 'https://logdigitizer.thedrake.ai/dashboard',
  '/digitizer/drake-slm-gpt': 'https://drakeslm.thedrake.ai',
  '/digitizer/drake-ocr': 'https://drakeocr.thedrake.ai',
}

export function openExternalModule(path: string) {
  const destination = DESTINATIONS[path]
  if (!destination) return false
  sessionStorage.setItem('drake_allow_external_navigation', 'true')
  window.location.assign(destination)
  return true
}
