import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ACCESS_MODULES, type ModuleId } from '../utils/accessControl'
import { useStore } from '../store'
import { authApi } from '../services/api'

interface ManagedUser {
  id: number
  username: string
  fullName: string
  modules: ModuleId[]
  active: boolean
  createdAt?: string
}

interface UserActivity {
  id: number
  userId: number
  username: string
  fullName: string
  action: 'login' | 'logout' | string
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

const emptyForm = {
  username: '',
  password: '',
  fullName: '',
  modules: [] as ModuleId[],
}

export default function AdminPanelPage() {
  const theme = useStore(s => s.theme)
  const logout = useStore(s => s.logout)
  const navigate = useNavigate()
  const isLight = theme === 'light'
  const palette = adminPalette(isLight)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [activities, setActivities] = useState<UserActivity[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const activeUsers = users.filter(user => user.active).length
  const assignedModuleCount = users.reduce((total, user) => total + user.modules.length, 0)
  const todayActivity = activities.filter(activity => isToday(activity.createdAt))
  const todayLogins = todayActivity.filter(activity => activity.action === 'login').length
  const todayLogouts = todayActivity.filter(activity => activity.action === 'logout').length
  const visibleActivities = selectedUserId === 'all'
    ? activities
    : activities.filter(activity => activity.userId === selectedUserId)

  const loadUsers = async () => {
    try {
      const { data } = await authApi.listUsers()
      setUsers((data.users || []).map(mapApiUser))
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Unable to load users')
    }
  }

  const loadActivity = async () => {
    try {
      const { data } = await authApi.listActivity()
      setActivities((data.activities || []).map(mapActivity))
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Unable to load user activity')
    }
  }

  useEffect(() => {
    loadUsers()
    loadActivity()
  }, [])

  const groupedModules = useMemo(() => {
    return ACCESS_MODULES.reduce<Record<string, typeof ACCESS_MODULES>>((groups, module) => {
      groups[module.group] = [...(groups[module.group] || []), module]
      return groups
    }, {})
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const toggleModule = (moduleId: ModuleId) => {
    setForm(current => ({
      ...current,
      modules: current.modules.includes(moduleId)
        ? current.modules.filter(item => item !== moduleId)
        : [...current.modules, moduleId],
    }))
  }

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault()
    const username = form.username.trim()
    const password = form.password
    const fullName = form.fullName.trim() || username

    if (!username || (!editingId && !password)) {
      toast.error(editingId ? 'Username is required' : 'Username and password are required')
      return
    }
    if (!form.modules.length) {
      toast.error('Select at least one module for this user')
      return
    }
    try {
      const payload = { username, password: password || undefined, full_name: fullName, modules: form.modules, active: true }
      if (editingId) {
        const currentUser = users.find(user => user.id === editingId)
        await authApi.updateUser(editingId, { ...payload, active: currentUser?.active ?? true })
        toast.success('User access updated')
      } else {
        await authApi.createUser(payload)
        toast.success('User created')
      }
      await loadUsers()
      await loadActivity()
      resetForm()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Unable to save user')
    }
  }

  const editUser = (user: ManagedUser) => {
    setEditingId(user.id)
    setForm({ username: user.username, password: '', fullName: user.fullName, modules: user.modules })
  }

  const toggleUserStatus = async (user: ManagedUser) => {
    try {
      await authApi.updateUserStatus(user.id, !user.active)
      await loadUsers()
      await loadActivity()
      toast.success('User status updated')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Unable to update user status')
    }
  }

  const deleteUser = async (userId: number) => {
    try {
      await authApi.deleteUser(userId)
      await loadUsers()
      await loadActivity()
      if (editingId === userId) resetForm()
      toast.success('User removed')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Unable to delete user')
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      undefined
    }
    logout()
    navigate('/admin-login')
  }

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={palette.page}>
      <aside style={palette.sidebar}>
        <div style={brandLockup}>
          <img src={isLight ? '/logo_light.png' : '/logo.png'} alt="Drake AI Logo" style={logo} />
          <div>
            <div style={eyebrow}>Admin Dashboard</div>
            <div style={{ ...brandTitle, color: palette.text }}>Access Management</div>
          </div>
        </div>
        <nav style={sideNav}>
          <button type="button" onClick={() => scrollToSection('admin-overview')} style={palette.sideNavItem}><i className="fas fa-chart-simple"></i> Overview</button>
          <button type="button" onClick={() => scrollToSection('admin-create-user')} style={palette.sideNavItem}><i className="fas fa-user-plus"></i> Create User</button>
          <button type="button" onClick={() => scrollToSection('admin-users')} style={palette.sideNavItem}><i className="fas fa-users"></i> Client Credentials</button>
          <button type="button" onClick={() => scrollToSection('admin-activity')} style={palette.sideNavItem}><i className="fas fa-clock-rotate-left"></i> User History</button>
        </nav>
        <div style={sidebarFooter}>
          <div style={palette.sidebarNote}>
            <div style={{ color: palette.text, fontWeight: 900 }}>Shared Production DB</div>
            <div style={palette.muted}>Admin-created credentials work in the user portal.</div>
          </div>
          <button type="button" onClick={handleLogout} style={palette.logoutButton}>
            <i className="fas fa-right-from-bracket" style={{ marginRight: 8 }}></i>
            Logout
          </button>
        </div>
      </aside>

      <main style={palette.main}>
        <section id="admin-overview" style={palette.hero}>
          <div>
            <div style={eyebrow}>Admin Control</div>
            <h1 style={{ ...title, color: palette.text }}>User Access Panel</h1>
            <p style={palette.muted}>Create client credentials, assign modules, and track user login/logout activity from one production dashboard.</p>
          </div>
          <div style={statStrip}>
            <div style={palette.statCard}><span style={statValue}>{users.length}</span><span style={statLabel}>Total Users</span></div>
            <div style={palette.statCard}><span style={statValue}>{activeUsers}</span><span style={statLabel}>Active</span></div>
            <div style={palette.statCard}><span style={statValue}>{assignedModuleCount}</span><span style={statLabel}>Module Grants</span></div>
            <div style={palette.statCard}><span style={statValue}>{todayLogins}</span><span style={statLabel}>Today Logins</span></div>
            <div style={palette.statCard}><span style={statValue}>{todayLogouts}</span><span style={statLabel}>Today Logouts</span></div>
          </div>
        </section>

        <form id="admin-create-user" onSubmit={saveUser} style={palette.panel}>
          <div style={panelHeader}>
            <div>
              <div style={eyebrow}>{editingId ? 'Edit User' : 'Create User'}</div>
              <h2 style={{ ...panelTitle, color: palette.text }}>{editingId ? 'Update Credentials' : 'New Client Access'}</h2>
            </div>
            <div style={palette.panelBadge}>{editingId ? 'Editing' : 'New'}</div>
          </div>
          <div style={formGrid}>
            <label style={palette.fieldLabel}>User Name<input value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} style={palette.input} /></label>
            <label style={palette.fieldLabel}>Password<input value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} style={palette.input} /></label>
            <label style={palette.fieldLabel}>Display Name<input value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} style={palette.input} /></label>
          </div>

          <div style={moduleArea}>
            {Object.entries(groupedModules).map(([group, modules]) => (
              <div key={group} style={palette.moduleGroup}>
                <div style={groupTitle}>{group}</div>
                {modules.map(module => (
                  <label key={module.id} style={palette.checkRow}>
                    <input type="checkbox" checked={form.modules.includes(module.id)} onChange={() => toggleModule(module.id)} />
                    <span>{module.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div style={actions}>
            <button type="submit" style={primaryButton}>{editingId ? 'Save Changes' : 'Create User'}</button>
            {editingId ? <button type="button" onClick={resetForm} style={palette.secondaryButton}>Cancel</button> : null}
          </div>
        </form>

        <section id="admin-users" style={palette.panel}>
          <div style={panelHeader}>
            <div>
              <div style={eyebrow}>Created Users</div>
              <h2 style={{ ...panelTitle, color: palette.text }}>Client Credentials</h2>
            </div>
            <div style={palette.panelBadge}>{users.length} Accounts</div>
          </div>
          <div style={userList}>
            {users.map(user => (
              <div key={user.id} style={palette.userRow}>
                <div>
                  <div style={userNameRow}>
                    <div style={{ color: palette.text, fontWeight: 900 }}>{user.fullName}</div>
                    <span style={user.active ? activePill : disabledPill}>{user.active ? 'Active' : 'Disabled'}</span>
                  </div>
                  <div style={palette.muted}>{user.username}</div>
                  <div style={accessText}>{user.modules.length} module(s): {user.modules.map(moduleId => ACCESS_MODULES.find(module => module.id === moduleId)?.label || moduleId).join(', ')}</div>
                </div>
                <div style={rowActions}>
                  <button type="button" onClick={() => editUser(user)} style={palette.iconButton} title="Edit user"><i className="fas fa-pen"></i></button>
                  <button type="button" onClick={() => setSelectedUserId(user.id)} style={palette.iconButton} title="View activity"><i className="fas fa-clock-rotate-left"></i></button>
                  <button type="button" onClick={() => toggleUserStatus(user)} style={palette.iconButton} title={user.active ? 'Disable user' : 'Enable user'}><i className={`fas ${user.active ? 'fa-lock' : 'fa-unlock'}`}></i></button>
                  <button type="button" onClick={() => deleteUser(user.id)} style={dangerButton} title="Delete user"><i className="fas fa-trash"></i></button>
                </div>
              </div>
            ))}
            {!users.length ? <div style={palette.empty}>No user credentials created yet.</div> : null}
          </div>
        </section>

        <section id="admin-activity" style={palette.panel}>
        <div style={activityHeader}>
          <div>
            <div style={eyebrow}>User History</div>
            <h2 style={{ ...panelTitle, color: palette.text }}>Login & Logout Tracking</h2>
          </div>
          <select value={selectedUserId} onChange={event => setSelectedUserId(event.target.value === 'all' ? 'all' : Number(event.target.value))} style={palette.select}>
            <option value="all">All users</option>
            {users.map(user => <option key={user.id} value={user.id}>{user.fullName} ({user.username})</option>)}
          </select>
        </div>
        <div style={activityGrid}>
          {visibleActivities.slice(0, 80).map(activity => (
            <div key={activity.id} style={palette.activityRow}>
              <div style={activityIcon(activity.action)}>
                <i className={`fas ${activity.action === 'login' ? 'fa-arrow-right-to-bracket' : 'fa-arrow-right-from-bracket'}`}></i>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={activityTitle}>
                  <span style={{ color: palette.text, fontWeight: 900 }}>{activity.fullName}</span>
                  <span style={activity.action === 'login' ? loginPill : logoutPill}>{activity.action}</span>
                </div>
                <div style={palette.muted}>{activity.username} - {formatDateTime(activity.createdAt)}</div>
                <div style={accessText}>IP: {activity.ipAddress || 'Unknown'}</div>
              </div>
            </div>
          ))}
          {!visibleActivities.length ? <div style={palette.empty}>No login or logout activity recorded yet.</div> : null}
        </div>
      </section>
      </main>
    </div>
  )
}

function mapApiUser(user: any): ManagedUser {
  return {
    id: user.id,
    username: user.email,
    fullName: user.full_name,
    modules: user.accessModules || [],
    active: user.is_active,
    createdAt: user.created_at,
  }
}

function mapActivity(activity: any): UserActivity {
  return {
    id: activity.id,
    userId: activity.user_id,
    username: activity.username,
    fullName: activity.full_name,
    action: activity.action,
    ipAddress: activity.ip_address,
    userAgent: activity.user_agent,
    createdAt: activity.created_at,
  }
}

function isToday(value: string) {
  const date = new Date(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
}

function formatDateTime(value: string) {
  if (!value) return 'Unknown time'
  return new Date(value).toLocaleString()
}

const page: React.CSSProperties = { height: '100vh', overflow: 'hidden', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC', display: 'grid', gridTemplateColumns: '292px minmax(0,1fr)' }
const sidebar: React.CSSProperties = { height: '100vh', overflow: 'hidden', borderRight: '1px solid #26364F', background: 'linear-gradient(180deg,rgba(8,17,31,.98),rgba(5,11,20,.96))', padding: 22, display: 'flex', flexDirection: 'column', gap: 22, boxShadow: '18px 0 45px rgba(0,0,0,.22)', zIndex: 10 }
const main: React.CSSProperties = { height: '100vh', overflowY: 'auto', overflowX: 'hidden', padding: 24, scrollbarGutter: 'stable', scrollBehavior: 'smooth' }
const brandLockup: React.CSSProperties = { display: 'grid', gap: 12, minWidth: 0 }
const logo: React.CSSProperties = { width: 172, height: 72, objectFit: 'contain', justifySelf: 'start' }
const brandTitle: React.CSSProperties = { fontSize: 22, fontWeight: 900, lineHeight: 1.1, marginTop: 5 }
const sideNav: React.CSSProperties = { display: 'grid', gap: 8 }
const sideNavItem: React.CSSProperties = { width: '100%', minHeight: 42, border: '1px solid transparent', background: 'transparent', color: '#CBD5E1', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 900, textAlign: 'left' }
const sidebarFooter: React.CSSProperties = { marginTop: 'auto', display: 'grid', gap: 12 }
const sidebarNote: React.CSSProperties = { border: '1px solid #26364F', background: 'rgba(15,23,42,.72)', borderRadius: 12, padding: 13, display: 'grid', gap: 5 }
const logoutButton: React.CSSProperties = { width: '100%', minHeight: 44, border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0', borderRadius: 10, padding: '0 14px', fontWeight: 900, cursor: 'pointer' }
const hero: React.CSSProperties = { padding: 28, borderRadius: 16, border: '1px solid #26364F', background: 'linear-gradient(135deg,rgba(15,23,42,.94),rgba(7,17,31,.86))', display: 'grid', gridTemplateColumns: 'minmax(300px,1fr)', alignItems: 'center', gap: 22, boxShadow: '0 18px 50px rgba(0,0,0,.22)', width: '100%', scrollMarginTop: 24 }
const eyebrow: React.CSSProperties = { color: '#10B981', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 42, lineHeight: 1.08, fontWeight: 700 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const statStrip: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, width: '100%' }
const statCard: React.CSSProperties = { padding: '14px 16px', borderRadius: 12, border: '1px solid #26364F', background: 'rgba(8,17,31,.78)', display: 'grid', gap: 4 }
const statValue: React.CSSProperties = { color: '#F8FAFC', fontSize: 26, fontWeight: 900, lineHeight: 1 }
const statLabel: React.CSSProperties = { color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 900 }
const panel: React.CSSProperties = { padding: 24, borderRadius: 16, border: '1px solid #26364F', background: 'rgba(15,23,42,.84)', boxShadow: '0 18px 50px rgba(0,0,0,.2)', width: '100%', marginTop: 20, scrollMarginTop: 24 }
const panelHeader: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }
const panelBadge: React.CSSProperties = { border: '1px solid rgba(16,185,129,.45)', background: 'rgba(16,185,129,.11)', color: '#A7F3D0', borderRadius: 999, padding: '7px 11px', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, whiteSpace: 'nowrap' }
const panelTitle: React.CSSProperties = { margin: '6px 0 0', fontSize: 30, lineHeight: 1.16, fontWeight: 700 }
const formGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }
const fieldLabel: React.CSSProperties = { display: 'grid', gap: 7, color: '#9DB7D8', fontWeight: 800, fontSize: 13 }
const input: React.CSSProperties = { minHeight: 44, borderRadius: 10, border: '1px solid #26364F', background: '#07111F', color: '#F8FAFC', padding: '12px 13px', fontSize: 15, outline: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03)' }
const moduleArea: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginTop: 18 }
const moduleGroup: React.CSSProperties = { border: '1px solid #26364F', borderRadius: 12, padding: 14, background: 'linear-gradient(180deg,rgba(8,17,31,.98),rgba(8,17,31,.76))', minHeight: 132 }
const groupTitle: React.CSSProperties = { color: '#F8FAFC', fontWeight: 900, marginBottom: 12, fontSize: 15 }
const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, color: '#CBD5E1', fontSize: 14, fontWeight: 800, marginTop: 10, lineHeight: 1.35 }
const actions: React.CSSProperties = { display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }
const primaryButton: React.CSSProperties = { border: '1px solid #10B981', background: '#10B981', color: '#00150E', borderRadius: 10, padding: '12px 16px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 14px 28px rgba(16,185,129,.18)' }
const secondaryButton: React.CSSProperties = { border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0', borderRadius: 10, padding: '12px 15px', fontWeight: 900, cursor: 'pointer' }
const userList: React.CSSProperties = { display: 'grid', gap: 12 }
const userRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: 16, borderRadius: 12, border: '1px solid #26364F', background: 'linear-gradient(180deg,rgba(8,17,31,.98),rgba(8,17,31,.76))' }
const userNameRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }
const activePill: React.CSSProperties = { color: '#A7F3D0', background: 'rgba(16,185,129,.13)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 900 }
const disabledPill: React.CSSProperties = { ...activePill, color: '#FCA5A5', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)' }
const accessText: React.CSSProperties = { marginTop: 6, color: '#9DB7D8', fontSize: 13, lineHeight: 1.45 }
const rowActions: React.CSSProperties = { display: 'flex', gap: 7 }
const iconButton: React.CSSProperties = { width: 38, height: 38, borderRadius: 9, border: '1px solid #26364F', background: '#0E1622', color: '#E2E8F0', cursor: 'pointer' }
const dangerButton: React.CSSProperties = { ...iconButton, color: '#FCA5A5' }
const empty: React.CSSProperties = { padding: 18, borderRadius: 12, border: '1px dashed #26364F', color: '#94A3B8', textAlign: 'center' }
const activityHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 16 }
const select: React.CSSProperties = { minWidth: 260, minHeight: 42, borderRadius: 10, border: '1px solid #26364F', background: '#07111F', color: '#F8FAFC', padding: '0 12px', fontWeight: 900, outline: 'none' }
const activityGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }
const activityRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '42px 1fr', gap: 12, alignItems: 'center', padding: 14, borderRadius: 12, border: '1px solid #26364F', background: 'linear-gradient(180deg,rgba(8,17,31,.98),rgba(8,17,31,.76))' }
const activityTitle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }
const loginPill: React.CSSProperties = { color: '#A7F3D0', background: 'rgba(16,185,129,.13)', border: '1px solid rgba(16,185,129,.35)', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }
const logoutPill: React.CSSProperties = { ...loginPill, color: '#BFDBFE', background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.35)' }

function activityIcon(action: string): React.CSSProperties {
  const isLogin = action === 'login'
  return {
    width: 42,
    height: 42,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    color: isLogin ? '#A7F3D0' : '#BFDBFE',
    background: isLogin ? 'rgba(16,185,129,.12)' : 'rgba(96,165,250,.12)',
    border: `1px solid ${isLogin ? 'rgba(16,185,129,.35)' : 'rgba(96,165,250,.35)'}`,
  }
}

function adminPalette(isLight: boolean) {
  const border = isLight ? '#D6DEE9' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const mutedColor = isLight ? '#64748B' : '#94A3B8'
  return {
    text,
    page: { ...page, background: isLight ? '#F8FAFC' : page.background, color: text } as React.CSSProperties,
    sidebar: { ...sidebar, borderRight: `1px solid ${border}`, background: isLight ? '#FFFFFF' : sidebar.background } as React.CSSProperties,
    main: { ...main } as React.CSSProperties,
    sideNavItem: { ...sideNavItem, color: isLight ? '#334155' : '#CBD5E1' } as React.CSSProperties,
    sidebarNote: { ...sidebarNote, border: `1px solid ${border}`, background: isLight ? '#F8FAFC' : sidebarNote.background } as React.CSSProperties,
    logoutButton: { ...logoutButton, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#FFFFFF' : '#08111F', color: text } as React.CSSProperties,
    hero: { ...hero, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : hero.background } as React.CSSProperties,
    muted: { ...muted, color: mutedColor } as React.CSSProperties,
    statCard: { ...statCard, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#F8FAFC' : statCard.background } as React.CSSProperties,
    panel: { ...panel, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : panel.background } as React.CSSProperties,
    panelBadge: { ...panelBadge, color: isLight ? '#047857' : '#A7F3D0', background: isLight ? '#ECFDF5' : panelBadge.background } as React.CSSProperties,
    fieldLabel: { ...fieldLabel, color: isLight ? '#475569' : '#9DB7D8' } as React.CSSProperties,
    input: { ...input, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#FFFFFF' : '#07111F', color: text } as React.CSSProperties,
    select: { ...select, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#FFFFFF' : '#07111F', color: text } as React.CSSProperties,
    moduleGroup: { ...moduleGroup, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#F8FAFC' : '#08111F' } as React.CSSProperties,
    checkRow: { ...checkRow, color: isLight ? '#334155' : '#CBD5E1' } as React.CSSProperties,
    secondaryButton: { ...secondaryButton, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#FFFFFF' : '#08111F', color: text } as React.CSSProperties,
    userRow: { ...userRow, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#F8FAFC' : '#08111F' } as React.CSSProperties,
    activityRow: { ...activityRow, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#F8FAFC' : activityRow.background } as React.CSSProperties,
    iconButton: { ...iconButton, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#FFFFFF' : '#0E1622', color: text } as React.CSSProperties,
    empty: { ...empty, border: `1px dashed ${isLight ? '#CBD5E1' : '#26364F'}`, color: mutedColor } as React.CSSProperties,
  }
}
