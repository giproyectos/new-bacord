import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, User, LogOut, Menu } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAuditStore } from '@/stores/auditStore'
import { randomUUID } from '@/utils/uuid'

// ── Types ──────────────────────────────────────────────────────────────────
interface NavLeaf   { label: string; to: string; icon?: string }
interface NavBranch { label: string; icon: string; key: string; children: NavLeaf[] }
interface NavGroup  { label: string; icon: string; key: string; children: (NavLeaf | NavBranch)[] }
type NavItem = NavGroup

function isLeaf(item: NavLeaf | NavBranch): item is NavLeaf {
  return 'to' in item
}

// Active if the current path starts with the item's route (covers sub-routes like /batch-records/5/editar)
function isPathActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(to + '/')
}

// ── Menu: Administrador ────────────────────────────────────────────────────
const NAV_ADMIN: NavItem[] = [
  {
    label: 'Producción', icon: 'fa-industry', key: 'ModuloProduccion',
    children: [
      { label: 'Batch Records',         icon: 'fa-clipboard-list', to: '/batch-records' },
      {
        label: 'Órdenes de Proceso', icon: 'fa-list-alt', key: 'LinkOrdenesProceso',
        children: [
          { label: 'Importar Órdenes', icon: 'fa-upload',   to: '/ordenes-proceso/cargar' },
          { label: 'Ver Órdenes',      icon: 'fa-table',    to: '/ordenes-proceso' },
        ],
      },
      { label: 'Fórmulas de Control',   icon: 'fa-vials',          to: '/formulas-control' },
    ],
  },
  {
    label: 'Calidad', icon: 'fa-certificate', key: 'ModuloCalidad',
    children: [
      { label: 'Firmas',               icon: 'fa-pen-nib',          to: '/firmas' },
      { label: 'Estrategias de Firma', icon: 'fa-sitemap',  to: '/estrategias-firma' },
    ],
  },
  {
    label: 'Configuración', icon: 'fa-sliders-h', key: 'ModuloConfiguracion',
    children: [
      { label: 'Recetas Maestras',      icon: 'fa-book-medical',  to: '/recetas-maestras' },
      { label: 'Materiales',            icon: 'fa-boxes',         to: '/administracion/materiales' },
      { label: 'Procesos',              icon: 'fa-cogs',          to: '/administracion/procesos' },
      { label: 'Parámetros',            icon: 'fa-sliders-h',     to: '/administracion/parametros' },
      { label: 'Centros',               icon: 'fa-building',      to: '/administracion/centros' },
      { label: 'Grupos Responsables',   icon: 'fa-users',         to: '/administracion/grupos-responsables' },
      { label: 'Formularios',           icon: 'fa-list-alt',      to: '/administracion/detalles' },
    ],
  },
  {
    label: 'Administración', icon: 'fa-shield-alt', key: 'ModuloAdministracion',
    children: [
      { label: 'Usuarios',  icon: 'fa-user',         to: '/administracion/usuarios' },
      { label: 'Roles',     icon: 'fa-user-shield',  to: '/administracion/roles' },
      {
        label: 'Auditoría', icon: 'fa-file-alt', key: 'LinkAuditoria',
        children: [
          { label: 'Consulta Log',     icon: 'fa-search',      to: '/admin/logs' },
          { label: 'Sesiones',         icon: 'fa-clock',       to: '/admin/sesiones' },
          { label: 'Log de Ingresos',  icon: 'fa-sign-in-alt', to: '/admin/log-logueos' },
        ],
      },
    ],
  },
]

// ── Menu: Calidad (QA) ─────────────────────────────────────────────────────
const NAV_CALIDAD: NavItem[] = [
  {
    label: 'Producción', icon: 'fa-industry', key: 'ModuloProduccion',
    children: [
      { label: 'Batch Records', icon: 'fa-clipboard-list', to: '/batch-records' },
    ],
  },
  {
    label: 'Calidad', icon: 'fa-certificate', key: 'ModuloCalidad',
    children: [
      { label: 'Firmas',               icon: 'fa-pen-nib',         to: '/firmas' },
      { label: 'Estrategias de Firma', icon: 'fa-sitemap', to: '/estrategias-firma' },
    ],
  },
]

// ── Menu: Operario / Producción ────────────────────────────────────────────
const NAV_OPERARIO: NavItem[] = [
  {
    label: 'Producción', icon: 'fa-industry', key: 'ModuloProduccion',
    children: [
      { label: 'Batch Records', icon: 'fa-clipboard-list', to: '/batch-records' },
    ],
  },
]

// ── Sub-item renderer ──────────────────────────────────────────────────────
function SubItem({ item }: { item: NavLeaf | NavBranch }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  if (isLeaf(item)) {
    const active = isPathActive(location.pathname, item.to)
    return (
      <NavLink
        to={item.to}
        className={`nav-sub-leaf${active ? ' active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {item.icon
          ? <i className={`fa ${item.icon}`} aria-hidden="true" />
          : <i className="fa fa-caret-right" aria-hidden="true" style={{ fontSize: 10 }} />
        }
        <span>{item.label}</span>
      </NavLink>
    )
  }

  const isChildActive = item.children.some(c => isPathActive(location.pathname, c.to))
  return (
    <div>
      <button
        className={`nav-branch${isChildActive ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open || isChildActive}
      >
        <i className={`fa ${item.icon}`} aria-hidden="true" style={{ marginRight: 8, width: 14 }} />
        <span>{item.label}</span>
        <span style={{ marginLeft: 'auto' }}>
          {(open || isChildActive) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>
      {(open || isChildActive) && (
        <div className="nav-sub-sub">
          {item.children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              className={({ isActive: _ia }) => {
                const active = isPathActive(location.pathname, c.to)
                return `nav-sub-leaf indent${active ? ' active' : ''}`
              }}
              aria-current={isPathActive(location.pathname, c.to) ? 'page' : undefined}
            >
              {c.icon
                ? <i className={`fa ${c.icon}`} aria-hidden="true" />
                : <i className="fa fa-caret-right" aria-hidden="true" style={{ fontSize: 10 }} />
              }
              <span>{c.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Top-level group renderer ───────────────────────────────────────────────
function TopItem({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const isChildActive = item.children.some((c) =>
    isLeaf(c)
      ? isPathActive(location.pathname, c.to)
      : c.children.some((cc) => isPathActive(location.pathname, cc.to))
  )

  const expanded = open || isChildActive

  return (
    <li className={`nav-top-item${isChildActive ? ' active open' : ''}`}>
      <button
        className="nav-top-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={expanded}
      >
        <i className={`fa ${item.icon}`} aria-hidden="true" style={{ marginRight: 10, width: 16 }} />
        <span>{item.label}</span>
        <span style={{ marginLeft: 'auto' }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>
      {expanded && (
        <ul className="sub-menu">
          {item.children.map((child, i) => (
            <li key={i}>
              <SubItem item={child} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Main layout ────────────────────────────────────────────────────────────
export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const user     = useAuthStore((s) => s.user)
  const logout   = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()

  const grupos    = user?.grupos?.split(',').map(g => g.trim()) ?? []
  const isAdmin   = !!user?.esAdministrador
  const isCalidad = grupos.includes('Calidad')
  const NAV       = isAdmin ? NAV_ADMIN : isCalidad ? NAV_CALIDAD : NAV_OPERARIO

  const handleLogout = () => {
    useAuditStore.getState().add({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      idUsuario: user?.idUsuario ?? 0,
      nombreUsuario: user ? `${user.nombres} ${user.apellidos}` : 'Desconocido',
      loginUsuario: user?.login ?? 'desconocido',
      cargo: 'Usuario del sistema',
      entidad: 'Sesion',
      idEntidad: user?.idUsuario ?? 0,
      descripcionEntidad: `Cierre de sesión — ${user?.login ?? ''}`,
      accion: 'LOGOUT',
      modulo: 'autenticacion',
    })
    logout()
    navigate('/login')
  }

  const PAGE_TITLES: Record<string, string> = {
    '/':                               'Inicio',
    '/batch-records':                  'Batch Records',
    '/recetas-maestras':               'Recetas Maestras',
    '/ordenes-proceso':                'Órdenes de Proceso',
    '/ordenes-proceso/cargar':         'Importar Órdenes de Proceso',
    '/formulas-control':               'Fórmulas de Control',
    '/formulas-control/crear':         'Nueva Fórmula de Control',
    '/firmas':                         'Firmas',
    '/estrategias-firma':              'Estrategias de Firma',
    '/administracion/usuarios':        'Usuarios',
    '/administracion/roles':           'Roles',
    '/administracion/centros':         'Centros',
    '/administracion/grupos-responsables': 'Grupos Responsables',
    '/administracion/materiales':      'Materiales',
    '/administracion/procesos':        'Procesos',
    '/administracion/parametros':      'Parámetros',
    '/administracion/detalles':        'Formularios',
    '/admin/logs':                     'Consulta de Modificaciones',
    '/admin/sesiones':                 'Sesiones Activas',
    '/admin/log-logueos':              'Log de Ingresos',
  }
  const dynamicTitles: [RegExp, string][] = [
    [/^\/batch-records\/\d+\/editar$/,          'Editar Batch Record'],
    [/^\/batch-records\/\d+\/consultar$/,        'Consultar Batch Record'],
    [/^\/recetas-maestras\/\d+\/configurar$/,    'Configurar Receta Maestra'],
    [/^\/formulas-control\/\d+$/,               'Detalle Fórmula de Control'],
    [/^\/ordenes-proceso\/\d+$/,                'Detalle Orden de Proceso'],
  ]
  const pageTitle = PAGE_TITLES[location.pathname]
    ?? dynamicTitles.find(([re]) => re.test(location.pathname))?.[1]
    ?? ''

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Shell ── */
        .shell { display: flex; height: 100vh; overflow: hidden; background: var(--paper); }

        /* ── Sidebar ── */
        .sidebar {
          width: ${sidebarOpen ? '224px' : '0'};
          min-width: ${sidebarOpen ? '224px' : '0'};
          overflow: hidden;
          transition: width 0.22s ease, min-width 0.22s ease;
          background: var(--navy);
          display: flex; flex-direction: column;
          border-right: 1px solid rgba(0,0,0,0.18);
          flex-shrink: 0;
        }
        .sidebar-inner {
          width: 224px; height: 100%;
          display: flex; flex-direction: column;
          overflow-y: auto; overflow-x: hidden;
        }
        .sidebar-inner::-webkit-scrollbar { width: 3px; }
        .sidebar-inner::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }

        /* Brand */
        .brand {
          padding: 16px 14px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .brand-logo {
          width: 34px; height: 34px; border-radius: 50%;
          background: #fff; display: grid; place-items: center;
          flex-shrink: 0; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.18);
          overflow: hidden; padding: 2px;
        }
        .brand-logo img { width: 100%; height: 100%; object-fit: contain; }
        .brand-logo-fallback {
          width: 34px; height: 34px; border-radius: 50%; background: #fff;
          display: grid; place-items: center; font-weight: 800; font-size: 13px;
          color: var(--navy); flex-shrink: 0;
        }
        .brand-text { font-weight: 800; font-size: 17px; color: #fff; letter-spacing: 0.03em; line-height: 1; }
        .brand-sub { font-family: var(--f-mono); font-size: 8px; color: #7A95C0; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 3px; }

        /* User block */
        .sidebar-user {
          padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .user-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, var(--yellow), var(--orange));
          display: grid; place-items: center;
          color: var(--navy-900); font-weight: 700; font-size: 12px; flex-shrink: 0;
        }
        .user-name { font-size: 12.5px; font-weight: 600; color: #fff; line-height: 1.2; }
        .user-roles { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }
        .user-role-badge {
          font-size: 9px; font-family: var(--f-mono); padding: 1px 6px;
          background: rgba(255,255,255,0.1); color: #8FA5C9;
          border-radius: 3px; letter-spacing: 0.05em;
        }

        /* Nav */
        .sidebar-nav { flex: 1; padding: 6px 0; }
        .sidebar-nav > ul { list-style: none; margin: 0; padding: 0; }

        /* Section separator */
        .nav-section-sep {
          height: 1px; background: rgba(255,255,255,0.06);
          margin: 4px 0;
        }

        /* Top-level group button */
        .nav-top-item { }
        .nav-top-btn {
          display: flex; align-items: center; width: 100%;
          padding: 9px 14px; background: none; border: none;
          color: #B8C6DE; font-size: 12.5px; font-weight: 600; font-family: var(--f-sans);
          cursor: pointer; text-align: left;
          transition: background 100ms, color 100ms;
          white-space: nowrap; letter-spacing: .01em;
          text-transform: uppercase; font-size: 10.5px; letter-spacing: .08em;
        }
        .nav-top-btn:hover { background: rgba(255,255,255,0.04); color: #fff; }
        .nav-top-item.active > .nav-top-btn { color: #fff; }
        .nav-top-btn:focus-visible { outline: 2px solid rgba(255,223,100,0.6); outline-offset: -2px; }

        /* Sub-menu wrapper */
        .sub-menu { list-style: none; margin: 0; padding: 0 0 4px; background: rgba(0,0,0,0.1); }

        /* Sub-branch button */
        .nav-branch {
          display: flex; align-items: center; width: 100%;
          padding: 8px 14px 8px 20px;
          background: none; border: none;
          color: #99AACC; font-size: 12.5px; font-family: var(--f-sans);
          cursor: pointer; transition: background 100ms, color 100ms; white-space: nowrap;
        }
        .nav-branch:hover { background: rgba(255,255,255,0.04); color: #fff; }
        .nav-branch.active { color: #fff; }
        .nav-branch:focus-visible { outline: 2px solid rgba(255,223,100,0.6); outline-offset: -2px; }

        /* Sub-sub wrapper */
        .nav-sub-sub { background: rgba(0,0,0,0.08); }

        /* Leaf items */
        .nav-sub-leaf {
          display: flex; align-items: center; gap: 9px;
          padding: 7px 14px 7px 22px;
          color: #8FA5C9; font-size: 12.5px; text-decoration: none;
          transition: background 80ms, color 80ms; white-space: nowrap;
        }
        .nav-sub-leaf i { width: 14px; text-align: center; flex-shrink: 0; font-size: 12px; }
        .nav-sub-leaf.indent { padding-left: 34px; }
        .nav-sub-leaf.indent i { font-size: 11px; }
        .nav-sub-leaf:hover { background: rgba(255,255,255,0.05); color: #D4E0F2; }
        .nav-sub-leaf:focus-visible { outline: 2px solid rgba(255,223,100,0.6); outline-offset: -2px; }
        .nav-sub-leaf.active {
          color: #fff;
          background: rgba(255,223,100,0.12);
          position: relative;
        }
        .nav-sub-leaf.active i { color: var(--yellow); }
        .nav-sub-leaf.active::before {
          content: ''; position: absolute;
          left: 0; top: 4px; bottom: 4px;
          width: 3px; background: var(--yellow); border-radius: 0 3px 3px 0;
        }

        /* Inicio link */
        .nav-inicio {
          display: flex; align-items: center; gap: 9px; width: 100%;
          padding: 9px 14px; background: none; border: none;
          color: #B8C6DE; font-size: 12.5px; font-family: var(--f-sans);
          cursor: pointer; text-align: left; text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 4px;
          transition: background 100ms, color 100ms; white-space: nowrap;
        }
        .nav-inicio i { width: 16px; text-align: center; font-size: 13px; }
        .nav-inicio:hover { background: rgba(255,255,255,0.04); color: #fff; }
        .nav-inicio.active { color: var(--yellow); background: rgba(255,223,100,0.08); }
        .nav-inicio.active i { color: var(--yellow); }
        .nav-inicio:focus-visible { outline: 2px solid rgba(255,223,100,0.6); outline-offset: -2px; }

        /* Collapse button */
        .sidebar-minify {
          padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
        }
        .sidebar-minify button {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.04); border: none; color: #7A95C0;
          padding: 7px 12px; border-radius: var(--r-sm); cursor: pointer;
          font-size: 12px; font-family: var(--f-sans); width: 100%;
          transition: background 100ms;
        }
        .sidebar-minify button:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .sidebar-minify button:focus-visible { outline: 2px solid rgba(255,223,100,0.6); }

        /* ── Right side ── */
        .right-side { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

        /* Top bar */
        .page-header-bar {
          display: flex; align-items: center; gap: 12px;
          padding: 0 20px; height: 52px;
          background: var(--navy); border-bottom: 1px solid rgba(0,0,0,0.2);
          flex-shrink: 0;
        }
        .header-toggle {
          background: none; border: none; color: rgba(255,255,255,0.6);
          cursor: pointer; padding: 6px; display: grid; place-items: center;
          border-radius: var(--r-sm); transition: background 100ms;
        }
        .header-toggle:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .header-toggle:focus-visible { outline: 2px solid rgba(255,223,100,0.6); }

        .header-brand { font-weight: 800; font-size: 16px; color: #fff; letter-spacing: 0.04em; }
        .header-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
        .header-user {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 10px; border-radius: var(--r-sm);
          cursor: default; color: rgba(255,255,255,0.85); font-size: 13px;
        }
        .header-user img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
        .header-logout {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; color: rgba(255,255,255,0.6);
          cursor: pointer; padding: 6px 10px; border-radius: var(--r-sm);
          font-family: var(--f-sans); font-size: 13px;
          transition: background 100ms;
        }
        .header-logout:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .header-logout:focus-visible { outline: 2px solid rgba(255,223,100,0.6); }

        /* Page title */
        .page-title-bar {
          padding: 14px 22px 0;
          background: var(--paper); flex-shrink: 0;
        }
        .page-title-bar h1 {
          font-size: 20px; font-weight: 700; color: var(--ink);
          margin: 0 0 12px; letter-spacing: -0.01em;
          border-bottom: 1px solid var(--hair-2); padding-bottom: 12px;
        }

        /* Content */
        .page-content {
          flex: 1; overflow-y: auto; padding: 18px 22px;
          background: #fff; min-height: 0;
        }
        .page-content::-webkit-scrollbar { width: 5px; }
        .page-content::-webkit-scrollbar-thumb { background: var(--hair-2); border-radius: 3px; }
      `}</style>

      <div className="shell">

        {/* ── Sidebar ── */}
        <div className="sidebar" aria-label="Navegación principal">
          <div className="sidebar-inner">

            {/* Brand */}
            <NavLink to="/" end style={{ textDecoration: 'none' }}>
              <div className="brand">
                <div className="brand-logo">
                  <img
                    src="/assets/zenttra-circular.png"
                    alt="BACord"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement
                      el.parentElement!.className = 'brand-logo-fallback'
                      el.parentElement!.textContent = 'B'
                    }}
                  />
                </div>
                <div>
                  <div className="brand-text"><b>BAC</b>ord</div>
                  <div className="brand-sub">By ZENTTRA</div>
                </div>
              </div>
            </NavLink>

            {/* User */}
            <div className="sidebar-user" aria-label="Usuario activo">
              <div className="user-avatar" aria-hidden="true">
                <User size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.nombres} {user?.apellidos}
                </div>
                <div className="user-roles">
                  {user?.roles?.map((r) => (
                    <span key={r} className="user-role-badge">{r}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav" aria-label="Módulos">
              <ul>
                {/* Inicio */}
                <li>
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) => `nav-inicio${isActive ? ' active' : ''}`}
                    aria-current={location.pathname === '/' ? 'page' : undefined}
                  >
                    <i className="fa fa-home" aria-hidden="true" />
                    <span>Inicio</span>
                  </NavLink>
                </li>

                {/* Dynamic sections with separators */}
                {NAV.map((item, idx) => (
                  <>
                    {idx > 0 && <div key={`sep-${idx}`} className="nav-section-sep" role="separator" />}
                    <TopItem key={item.key} item={item} />
                  </>
                ))}
              </ul>
            </nav>

            {/* Collapse */}
            <div className="sidebar-minify">
              <button onClick={() => setSidebarOpen(false)} aria-label="Colapsar menú">
                <i className="fa fa-angle-double-left" aria-hidden="true" />
                <span>Colapsar</span>
              </button>
            </div>

          </div>
        </div>

        {/* ── Right side ── */}
        <div className="right-side">

          {/* Top bar */}
          <div className="page-header-bar" role="banner">
            <button
              className="header-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
              aria-expanded={sidebarOpen}
            >
              <Menu size={18} />
            </button>
            <div className="header-brand" aria-hidden="true">
              <b>BAC</b><span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>ord</span>
            </div>
            <div className="header-right">
              <div className="header-user" aria-label={`Usuario: ${user?.nombres}`}>
                <img
                  src="/assets/zenttra-circular.png"
                  alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span>{user?.nombres}</span>
              </div>
              <button className="header-logout" onClick={handleLogout} aria-label="Cerrar sesión">
                <LogOut size={14} aria-hidden="true" />
                Salir
              </button>
            </div>
          </div>

          {/* Page title */}
          {pageTitle && (
            <div className="page-title-bar">
              <h1>{pageTitle}</h1>
            </div>
          )}

          {/* Content */}
          <main className="page-content" id="main-content">
            <Outlet />
          </main>

        </div>
      </div>
    </>
  )
}
