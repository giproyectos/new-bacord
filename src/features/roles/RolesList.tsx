import { useState } from 'react'
import { CatalogPage } from '@/components/shared/CatalogPage'

interface Rol { id: number; nombre: string; descripcion: string; firma: string; activo: number }

const mock: Rol[] = [
  { id: 1, nombre: 'Administrador', descripcion: 'Acceso total al sistema', firma: 'FIR-001', activo: 1 },
  { id: 2, nombre: 'Operador',      descripcion: 'Gestión de batch records', firma: 'FIR-002', activo: 1 },
  { id: 3, nombre: 'Calidad',       descripcion: 'Revisión y aprobación',    firma: 'FIR-003', activo: 1 },
]

const MODULOS_MOCK = ['Batch Record', 'Fórmulas de Control', 'Órdenes de Proceso', 'Firmas', 'Estrategia de Firmas', 'Recetas Maestras', 'Usuarios', 'Roles', 'Centros', 'Materiales', 'Procesos', 'Grupos Responsables', 'Parámetros', 'Detalles']

export function RolesList() {
  const [modulosModal, setModulosModal] = useState<Rol | null>(null)

  return (
    <>
      <CatalogPage<Rol>
        panelTitle="Lista de roles"
        data={mock}
        columns={[
          { key: 'nombre',      header: 'Nombre rol' },
          { key: 'descripcion', header: 'Descripción' },
          { key: 'firma',       header: 'Firma',  width: '10%' },
          { key: 'activo',      header: 'Activo', width: '7%', render: r => r.activo ? 'Sí' : 'No' },
        ]}
        fields={[
          { key: 'nombre',      label: 'Nombre rol',  required: true },
          { key: 'descripcion', label: 'Descripción', required: true },
        ]}
        extraActions={(row) => (
          <button className="dt-ab dt-ab-extra" title="Administrar módulos" onClick={() => setModulosModal(row)}>
            <i className="fa fa-cogs" />
          </button>
        )}
      />

      {modulosModal && (
        <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(10,21,48,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }} onClick={() => setModulosModal(null)}>
          <div style={{ background:'var(--paper)',borderRadius:'var(--r-xl)',boxShadow:'var(--sh-3)',width:'100%',maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 22px',borderBottom:'1px solid var(--hair)',fontSize:15,fontWeight:700,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span>Módulos — {modulosModal.nombre}</span>
              <button style={{ background:'none',border:'none',cursor:'pointer',color:'var(--ink-4)',fontSize:18 }} onClick={() => setModulosModal(null)}>×</button>
            </div>
            <div style={{ padding:'18px 22px' }}>
              <p style={{ fontSize:13,color:'var(--ink-3)',marginBottom:12 }}>Seleccione los módulos accesibles para este rol:</p>
              {MODULOS_MOCK.map(mod => (
                <label key={mod} style={{ display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid var(--hair)',fontSize:13.5,color:'var(--ink-2)',cursor:'pointer' }}>
                  <input type="checkbox" defaultChecked />
                  {mod}
                </label>
              ))}
            </div>
            <div style={{ padding:'14px 22px',borderTop:'1px solid var(--hair)',display:'flex',justifyContent:'flex-end',gap:8 }}>
              <button className="btn btn-gray" onClick={() => setModulosModal(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={() => setModulosModal(null)}><i className="fa fa-check" /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
