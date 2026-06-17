import type { EnterpriseProject, EnterpriseProjectFile } from '../store'

type DirectoryHandle = any
type FileHandle = any

const DB_NAME = 'drake-local-project-storage'
const DB_VERSION = 1
const HANDLE_STORE = 'project-handles'
const REGISTRY_KEY = 'drake_local_project_registry'
const CURRENT_PROJECT_KEY = 'drake_enterprise_project'

const RESULT_MODULES = ['petrophysics', 'seismic', 'production', 'ccus', 'geothermal', 'digitizer', 'integrated-study']

type ProjectForm = {
  project_name: string
  description?: string
  project_type?: string
  storage_location?: string
  custom_folder?: string
}

type SaveResultRequest = {
  module_name: string
  prediction_name: string
  extension?: string
  result_payload: any
}

type SaveExportRequest = {
  module_name: string
  export_type: string
  prediction_name: string
  extension?: string
  content?: string
  content_base64?: string
}

function getPicker() {
  const picker = (window as any).showDirectoryPicker
  if (!picker) throw new Error('Local folder projects require Chrome or Edge with File System Access API support.')
  return picker
}

function nowIso() {
  return new Date().toISOString()
}

function randomId(prefix: string) {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${uuid}`
}

function safeName(name: string, fallback = 'drake-project') {
  const cleaned = (name || fallback).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, ' ').slice(0, 90)
  return cleaned || fallback
}

function safeFileName(name: string) {
  return safeName(name, 'file').replace(/\.+$/g, '')
}

function extensionOf(name: string, fallback = 'file') {
  return name.split('.').pop()?.toLowerCase() || fallback
}

function bucketForFile(name: string) {
  const ext = extensionOf(name)
  if (ext === 'las') return 'las'
  if (['csv', 'xls', 'xlsx'].includes(ext)) return 'tables'
  if (['sgy', 'segy', 'npy'].includes(ext)) return 'seismic'
  if (['png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff'].includes(ext)) return 'images'
  if (['pdf', 'doc', 'docx'].includes(ext)) return 'reports'
  return 'others'
}

function compatibilityForFile(name: string) {
  const ext = extensionOf(name)
  if (ext === 'las') return ['Petrophysics', 'CCUS', 'Geothermal']
  if (['csv', 'xls', 'xlsx'].includes(ext)) return ['Petrophysics', 'Production', 'CCUS', 'Geothermal']
  if (['sgy', 'segy', 'npy'].includes(ext)) return ['Seismic']
  if (['png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'pdf'].includes(ext)) return ['Digitizer', 'Reports']
  return ['All Modules']
}

function moduleFolder(moduleName: string) {
  const normalized = moduleName.toLowerCase()
  if (normalized.includes('seismic')) return 'seismic'
  if (normalized.includes('production')) return 'production'
  if (normalized.includes('ccus')) return 'ccus'
  if (normalized.includes('geothermal')) return 'geothermal'
  if (normalized.includes('digitizer')) return 'digitizer'
  if (normalized.includes('integrated')) return 'integrated-study'
  return 'petrophysics'
}

function timestampName() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '')
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function putHandle(projectId: string, handle: DirectoryHandle) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite')
    tx.objectStore(HANDLE_STORE).put(handle, projectId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getProjectHandle(projectId: string): Promise<DirectoryHandle | null> {
  const db = await openDb()
  const handle = await new Promise<DirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly')
    const request = tx.objectStore(HANDLE_STORE).get(projectId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return handle
}

async function ensurePermission(handle: DirectoryHandle, mode: 'read' | 'readwrite' = 'readwrite') {
  if (!handle?.queryPermission || !handle?.requestPermission) return true
  if (await handle.queryPermission({ mode }) === 'granted') return true
  return await handle.requestPermission({ mode }) === 'granted'
}

async function writableProjectHandle(project: EnterpriseProject) {
  const handle = await getProjectHandle(project.project_id)
  if (!handle) throw new Error('Please open this project folder once to restore local folder permission.')
  if (!(await ensurePermission(handle, 'readwrite'))) throw new Error('Local project folder permission was not granted.')
  return handle
}

async function getOrCreateDir(root: DirectoryHandle, parts: string[]) {
  let current = root
  for (const part of parts.filter(Boolean)) current = await current.getDirectoryHandle(part, { create: true })
  return current
}

async function getDir(root: DirectoryHandle, parts: string[]) {
  let current = root
  for (const part of parts.filter(Boolean)) current = await current.getDirectoryHandle(part)
  return current
}

async function writeBlob(root: DirectoryHandle, relativePath: string, blob: Blob) {
  const parts = relativePath.split('/').filter(Boolean)
  const filename = parts.pop()
  if (!filename) throw new Error('Invalid file path')
  const dir = await getOrCreateDir(root, parts)
  const handle: FileHandle = await dir.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

async function writeText(root: DirectoryHandle, relativePath: string, text: string) {
  await writeBlob(root, relativePath, new Blob([text], { type: 'application/json;charset=utf-8' }))
}

async function readText(root: DirectoryHandle, relativePath: string) {
  const parts = relativePath.split('/').filter(Boolean)
  const filename = parts.pop()
  if (!filename) throw new Error('Invalid file path')
  const dir = await getDir(root, parts)
  const handle = await dir.getFileHandle(filename)
  const file = await handle.getFile()
  return file.text()
}

async function initProjectTree(root: DirectoryHandle) {
  await Promise.all([
    getOrCreateDir(root, ['uploads', 'las']),
    getOrCreateDir(root, ['uploads', 'tables']),
    getOrCreateDir(root, ['uploads', 'seismic']),
    getOrCreateDir(root, ['uploads', 'images']),
    getOrCreateDir(root, ['uploads', 'reports']),
    getOrCreateDir(root, ['uploads', 'others']),
    getOrCreateDir(root, ['reports']),
    ...RESULT_MODULES.flatMap(module => [
      getOrCreateDir(root, ['results', module]),
      getOrCreateDir(root, ['results', module, 'exports']),
    ]),
  ])
}

function readRegistry(): EnterpriseProject[] {
  try {
    return JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]')
  } catch {
    return []
  }
}

function writeRegistry(projects: EnterpriseProject[]) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(projects))
}

function rememberProject(project: EnterpriseProject) {
  const registry = [project, ...readRegistry().filter(item => item.project_id !== project.project_id)]
  writeRegistry(registry)
  localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(project))
}

async function writeProjectJson(handle: DirectoryHandle, project: EnterpriseProject) {
  const updated = { ...project, updated_at: nowIso() }
  await writeText(handle, 'project.json', JSON.stringify(updated, null, 2))
  rememberProject(updated)
  return updated
}

export function listLocalProjects() {
  return readRegistry()
}

export function getCurrentLocalProject() {
  try {
    const raw = localStorage.getItem(CURRENT_PROJECT_KEY)
    return raw ? JSON.parse(raw) as EnterpriseProject : null
  } catch {
    return null
  }
}

export async function createLocalFolderProject(form: ProjectForm) {
  const picker = getPicker()
  const parent = await picker({ mode: 'readwrite' })
  if (!(await ensurePermission(parent, 'readwrite'))) throw new Error('Local folder permission was not granted.')
  const folderName = safeName(form.project_name, 'Drake AI Project')
  const projectHandle = await parent.getDirectoryHandle(folderName, { create: true })
  await initProjectTree(projectHandle)
  const now = nowIso()
  const project: EnterpriseProject = {
    project_id: randomId('project'),
    project_name: form.project_name.trim(),
    description: form.description || '',
    project_type: form.project_type || 'Integrated Study',
    storage_location: 'Local Browser Folder',
    created_at: now,
    updated_at: now,
    project_path: `${parent.name}/${folderName}`,
    uploaded_files: [],
    generated_results: [],
    exported_files: [],
    module_history: [{ id: randomId('history'), timestamp: now, module_name: 'Projects', action: 'Project created locally', status: 'Complete' }],
    dashboard_state: {},
  }
  await putHandle(project.project_id, projectHandle)
  return writeProjectJson(projectHandle, project)
}

export async function openLocalFolderProject() {
  const picker = getPicker()
  const projectHandle = await picker({ mode: 'readwrite' })
  if (!(await ensurePermission(projectHandle, 'readwrite'))) throw new Error('Local project folder permission was not granted.')
  const raw = await readText(projectHandle, 'project.json')
  const project = JSON.parse(raw) as EnterpriseProject
  if (!project.project_id || !project.project_name) throw new Error('Selected folder is not a valid Drake AI project.')
  await initProjectTree(projectHandle)
  await putHandle(project.project_id, projectHandle)
  const opened = {
    ...project,
    project_path: project.project_path || projectHandle.name,
    module_history: [
      { id: randomId('history'), timestamp: nowIso(), module_name: 'Projects', action: 'Project opened from local folder', status: 'Complete' },
      ...(project.module_history || []),
    ],
  }
  return writeProjectJson(projectHandle, opened)
}

export async function openKnownLocalProject(project: EnterpriseProject) {
  const projectHandle = await getProjectHandle(project.project_id)
  if (!projectHandle) return openLocalFolderProject()
  if (!(await ensurePermission(projectHandle, 'readwrite'))) return openLocalFolderProject()
  await initProjectTree(projectHandle)
  const raw = await readText(projectHandle, 'project.json')
  const latest = JSON.parse(raw) as EnterpriseProject
  const opened = {
    ...latest,
    module_history: [
      { id: randomId('history'), timestamp: nowIso(), module_name: 'Projects', action: 'Project opened from local registry', status: 'Complete' },
      ...(latest.module_history || []),
    ],
  }
  return writeProjectJson(projectHandle, opened)
}

export async function uploadFilesToLocalProject(project: EnterpriseProject, files: File[]) {
  const handle = await writableProjectHandle(project)
  const now = nowIso()
  const records: EnterpriseProjectFile[] = []
  for (const file of files) {
    const bucket = bucketForFile(file.name)
    const fileId = randomId('file')
    const storedName = `${fileId}_${safeFileName(file.name)}`
    const relativePath = `uploads/${bucket}/${storedName}`
    await writeBlob(handle, relativePath, file)
    records.push({
      file_id: fileId,
      file_name: file.name,
      file_type: extensionOf(file.name).toUpperCase(),
      size_bytes: file.size,
      uploaded_at: now,
      source_path: file.name,
      project_path: `${project.project_path}/${relativePath}`,
      relative_path: relativePath,
      bucket,
      compatibility: compatibilityForFile(file.name),
    })
  }
  const updated: EnterpriseProject = {
    ...project,
    uploaded_files: [...records, ...(project.uploaded_files || [])],
    module_history: [
      { id: randomId('history'), timestamp: now, module_name: 'Project Files', action: `${records.length} file(s) uploaded locally`, status: 'Complete' },
      ...(project.module_history || []),
    ],
  }
  return { data: { project: await writeProjectJson(handle, updated), files: records } }
}

export async function readLocalProjectFile(project: EnterpriseProject, record: EnterpriseProjectFile) {
  const handle = await writableProjectHandle(project)
  const parts = record.relative_path.split('/').filter(Boolean)
  const filename = parts.pop()
  if (!filename) throw new Error('Invalid project file path')
  const dir = await getDir(handle, parts)
  const fileHandle = await dir.getFileHandle(filename)
  const file = await fileHandle.getFile()
  return new File([file], record.file_name, { type: file.type || 'application/octet-stream', lastModified: file.lastModified })
}

export async function saveResultToLocalProject(project: EnterpriseProject, request: SaveResultRequest) {
  const handle = await writableProjectHandle(project)
  const extension = (request.extension || 'json').replace(/^\./, '')
  const folder = moduleFolder(request.module_name)
  const filename = `${safeFileName(request.prediction_name || 'result')}_${timestampName()}.${extension}`
  const relativePath = `results/${folder}/${filename}`
  await writeText(handle, relativePath, JSON.stringify(request.result_payload ?? {}, null, 2))
  const record = {
    result_id: randomId('result'),
    file_name: filename,
    module_name: request.module_name,
    prediction_name: request.prediction_name,
    extension,
    project_path: `${project.project_path}/${relativePath}`,
    relative_path: relativePath,
    created_at: nowIso(),
  }
  const updated: EnterpriseProject = {
    ...project,
    generated_results: [record, ...(project.generated_results || [])],
    module_history: [
      { id: randomId('history'), timestamp: record.created_at, module_name: request.module_name, action: 'Result saved locally', status: 'Complete' },
      ...(project.module_history || []),
    ],
  }
  return { data: { project: await writeProjectJson(handle, updated), result: record } }
}

function blobFromBase64(contentBase64: string, mime = 'application/octet-stream') {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

export async function saveExportToLocalProject(project: EnterpriseProject, request: SaveExportRequest) {
  const handle = await writableProjectHandle(project)
  const extension = (request.extension || request.export_type || 'txt').replace(/^\./, '').toLowerCase()
  const folder = moduleFolder(request.module_name)
  const filename = `${safeFileName(request.prediction_name || 'export')}_${timestampName()}.${extension}`
  const relativePath = `results/${folder}/exports/${filename}`
  const blob = request.content_base64
    ? blobFromBase64(request.content_base64)
    : new Blob([request.content || ''], { type: extension === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' })
  await writeBlob(handle, relativePath, blob)
  const record = {
    export_id: randomId('export'),
    file_name: filename,
    module_name: request.module_name,
    export_type: request.export_type,
    prediction_name: request.prediction_name,
    extension,
    project_path: `${project.project_path}/${relativePath}`,
    relative_path: relativePath,
    created_at: nowIso(),
  }
  const updated: EnterpriseProject = {
    ...project,
    exported_files: [record, ...(project.exported_files || [])],
    module_history: [
      { id: randomId('history'), timestamp: record.created_at, module_name: request.module_name, action: `${extension.toUpperCase()} export saved locally`, status: 'Complete' },
      ...(project.module_history || []),
    ],
  }
  return { data: { project: await writeProjectJson(handle, updated), export: record } }
}
