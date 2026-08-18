import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AuthGuard } from '@/guards/AuthGuard'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

const lz = (fn: () => Promise<Record<string, unknown>>, key: string) =>
  lazy(() => fn().then(m => ({ default: m[key] as React.ComponentType })))

// Pantallas
const LoginPage            = lz(() => import('@/features/auth/LoginPage'), 'LoginPage')
const DashboardPage        = lz(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage')
const BatchRecordList      = lz(() => import('@/features/batch-record/BatchRecordList'), 'BatchRecordList')
const EditarBatchRecord    = lz(() => import('@/features/batch-record/EditarBatchRecord'), 'EditarBatchRecord')
const ConsultarBatchRecord = lz(() => import('@/features/batch-record/ConsultarBatchRecord'), 'ConsultarBatchRecord')
const RecetaMaestraList    = lz(() => import('@/features/receta-maestra/RecetaMaestraList'), 'RecetaMaestraList')
const RecetaMaestraEditor  = lz(() => import('@/features/receta-maestra/RecetaMaestraEditor'), 'RecetaMaestraEditor')
const OrdenProcesoList     = lz(() => import('@/features/orden-proceso/OrdenProcesoList'), 'OrdenProcesoList')
const FormulaControlList   = lz(() => import('@/features/formula-control/FormulaControlList'), 'FormulaControlList')
const FormulaControlCrear  = lz(() => import('@/features/formula-control/FormulaControlCrear'), 'FormulaControlCrear')
const FirmasList           = lz(() => import('@/features/firmas/FirmasList'), 'FirmasList')
const EstrategiaFirmasList = lz(() => import('@/features/estrategia-firmas/EstrategiaFirmasList'), 'EstrategiaFirmasList')
const CargueOPList            = lz(() => import('@/features/cargue-op/CargueOPList'), 'CargueOPList')
const OrdenProcesoDetalle     = lz(() => import('@/features/orden-proceso/OrdenProcesoDetalle'), 'OrdenProcesoDetalle')
const FormulaControlDetalle   = lz(() => import('@/features/formula-control/FormulaControlDetalle'), 'FormulaControlDetalle')
const UsuariosList         = lz(() => import('@/features/usuarios/UsuariosList'), 'UsuariosList')
const RolesList            = lz(() => import('@/features/roles/RolesList'), 'RolesList')
const ConsultaLog          = lz(() => import('@/features/admin/ConsultaLog'), 'ConsultaLog')
const Sesiones             = lz(() => import('@/features/admin/Sesiones'), 'Sesiones')
const LogLogueos           = lz(() => import('@/features/admin/LogLogueos'), 'LogLogueos')

// Catálogos
const CentrosList              = lz(() => import('@/features/catalogos/CentrosList'), 'CentrosList')
const MaterialesList           = lz(() => import('@/features/catalogos'), 'MaterialesList')
const ProcesosList             = lz(() => import('@/features/catalogos/ProcesosList'), 'ProcesosList')
const GruposResponsablesList   = lz(() => import('@/features/catalogos/GruposResponsablesList'), 'GruposResponsablesList')
const ParametrosList           = lz(() => import('@/features/catalogos'), 'ParametrosList')
const DetallesList             = lz(() => import('@/features/catalogos/DetallesList'), 'DetallesList')

function Spin() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
      <div style={{ width: 26, height: 26, border: '3px solid var(--hair-2)', borderTopColor: 'var(--navy)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const w = (el: React.ReactNode) => <ErrorBoundary><Suspense fallback={<Spin />}>{el}</Suspense></ErrorBoundary>

export const router = createBrowserRouter([
  { path: '/login', element: <AuthLayout />, children: [{ index: true, element: w(<LoginPage />) }] },
  {
    element: <AuthGuard />,
    children: [{
      element: <MainLayout />,
      children: [
        { path: '/',  element: w(<DashboardPage />) },

        // Operación
        { path: '/batch-records',                element: w(<BatchRecordList />) },
        { path: '/batch-records/:id/editar',     element: w(<EditarBatchRecord />) },
        { path: '/batch-records/:id/consultar',  element: w(<ConsultarBatchRecord />) },
        { path: '/formulas-control',             element: w(<FormulaControlList />) },
        { path: '/formulas-control/crear',       element: w(<FormulaControlCrear />) },
        { path: '/formulas-control/:id',         element: w(<FormulaControlDetalle />) },
        { path: '/ordenes-proceso',              element: w(<OrdenProcesoList />) },
        { path: '/ordenes-proceso/cargar',       element: w(<CargueOPList />) },
        { path: '/ordenes-proceso/:id',          element: w(<OrdenProcesoDetalle />) },
        { path: '/firmas',                       element: w(<FirmasList />) },
        { path: '/estrategias-firma',            element: w(<EstrategiaFirmasList />) },

        // Administración
        { path: '/recetas-maestras',                     element: w(<RecetaMaestraList />) },
        { path: '/recetas-maestras/:id/configurar',      element: w(<RecetaMaestraEditor />) },
        { path: '/administracion/usuarios',              element: w(<UsuariosList />) },
        { path: '/administracion/roles',                 element: w(<RolesList />) },
        { path: '/admin/logs',                           element: w(<ConsultaLog />) },
        { path: '/admin/sesiones',                       element: w(<Sesiones />) },
        { path: '/admin/log-logueos',                    element: w(<LogLogueos />) },
        { path: '/administracion/centros',               element: w(<CentrosList />) },
        { path: '/administracion/grupos-responsables',   element: w(<GruposResponsablesList />) },
        { path: '/administracion/materiales',            element: w(<MaterialesList />) },
        { path: '/administracion/procesos',              element: w(<ProcesosList />) },
        { path: '/administracion/parametros',            element: w(<ParametrosList />) },
        { path: '/administracion/detalles',              element: w(<DetallesList />) },


        { path: '*', element: <Navigate to="/" replace /> },
      ],
    }],
  },
])
