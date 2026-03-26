import { Outlet, NavLink } from 'react-router-dom'

const tabs = [
  { to: '/',         label: '首頁',   icon: HomeIcon },
  { to: '/voice',    label: '語音',   icon: MicIcon },
  { to: '/calendar', label: '行事曆', icon: CalIcon },
  { to: '/activity', label: '運動',   icon: ActivityIcon },
  { to: '/trip',     label: '行程',   icon: PlaneIcon },
]

export default function Layout() {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
      <nav style={{
        height: 'var(--nav-h)',
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'stretch',
        flexShrink: 0,
      }}>
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              color: isActive ? 'var(--accent2)' : 'var(--text3)',
              transition: 'color 0.15s',
            })}>
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function HomeIcon({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
}
function MicIcon({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
}
function CalIcon({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function ActivityIcon({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
}
function PlaneIcon({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5c-1.5-1.5-3.5-1.5-5 0L11 6 2.8 4.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 1 1 2 2 1-1v-3l3-2 6.2 7.3c.4.4.9.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
}
