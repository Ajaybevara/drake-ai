import toast from 'react-hot-toast'
import type { DrakeProjectDocument, LocalProject } from '../store'

const SCHEMA_VERSION = 1

export function buildDrakeDocument(project: LocalProject): DrakeProjectDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    app: 'Drake AI Enterprise Platform',
    savedAt: new Date().toISOString(),
    project,
  }
}

export function normalizeDrakeProject(raw: any): LocalProject {
  const project = raw?.project || raw
  if (!project?.name) throw new Error('Invalid .drake project file.')
  const now = new Date().toISOString()
  return {
    id: project.id || `project-${Date.now()}`,
    name: project.name,
    createdAt: project.createdAt || now,
    lastOpenedAt: now,
    files: project.files || [],
    selectedWells: project.selectedWells || [],
    moduleState: project.moduleState || {},
    outputs: project.outputs || [],
    activity: project.activity || [],
  }
}

export async function createProjectFile(project: LocalProject) {
  const fileName = ensureDrakeExtension(project.name)
  const handle = await requestSaveHandle(fileName)
  if (handle) {
    await writeProjectToHandle(handle, project)
    return { handle, fileName: handle.name || fileName, usedFallback: false }
  }
  downloadDrakeFile(project, fileName)
  return { handle: null, fileName, usedFallback: true }
}

export async function saveProjectFile(project: LocalProject, existingHandle?: any | null) {
  let handle = existingHandle
  if (!handle) handle = await requestSaveHandle(ensureDrakeExtension(project.name))
  if (handle) {
    await writeProjectToHandle(handle, project)
    return { handle, fileName: handle.name || ensureDrakeExtension(project.name), usedFallback: false }
  }
  const fileName = ensureDrakeExtension(project.name)
  downloadDrakeFile(project, fileName)
  return { handle: null, fileName, usedFallback: true }
}

export async function openProjectFile(): Promise<{ project: LocalProject; handle: any | null; fileName: string }> {
  const picker = (window as any).showOpenFilePicker
  if (picker) {
    const [handle] = await picker({
      types: [{ description: 'Drake Project File', accept: { 'application/json': ['.drake', '.json'] } }],
      excludeAcceptAllOption: false,
      multiple: false,
    })
    const file = await handle.getFile()
    const project = normalizeDrakeProject(JSON.parse(await file.text()))
    return { project, handle, fileName: file.name }
  }
  const file = await pickFallbackFile()
  const project = normalizeDrakeProject(JSON.parse(await file.text()))
  return { project, handle: null, fileName: file.name }
}

async function requestSaveHandle(suggestedName: string) {
  const picker = (window as any).showSaveFilePicker
  if (!picker) return null
  try {
    return await picker({
      suggestedName,
      types: [{ description: 'Drake Project File', accept: { 'application/json': ['.drake'] } }],
      excludeAcceptAllOption: false,
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error
    toast.error('Native file save is restricted. Download fallback will be used.')
    return null
  }
}

async function writeProjectToHandle(handle: any, project: LocalProject) {
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(buildDrakeDocument(project), null, 2))
  await writable.close()
}

function downloadDrakeFile(project: LocalProject, fileName: string) {
  const blob = new Blob([JSON.stringify(buildDrakeDocument(project), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function pickFallbackFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.drake,.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) resolve(file)
      else reject(new Error('No project file selected.'))
    }
    input.click()
  })
}

function ensureDrakeExtension(name: string) {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_') || 'drake_project'
  return safe.toLowerCase().endsWith('.drake') ? safe : `${safe}.drake`
}
