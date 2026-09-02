import { useEffect, useMemo, useState } from 'react'
import { CatalogPage } from '@/components/shared/CatalogPage'
import { materialesApi, TIPO_MATERIAL_LABELS, type Material, type TipoMaterial } from '@/api/materiales'
import { parametrosApi, type Parametro } from '@/api/parametros'
import { usePuedeEditar } from '@/hooks/usePermisos'

// ── Materiales ────────────────────────────────────────────────────────────

const TIPO_MATERIAL_OPTIONS: { value: TipoMaterial; label: string }[] =
  (Object.keys(TIPO_MATERIAL_LABELS) as TipoMaterial[]).map(v => ({ value: v, label: TIPO_MATERIAL_LABELS[v] }))

const TIPO_BADGE: Record<TipoMaterial, { bg: string; color: string }> = {
  PRODUCTO_TERMINADO: { bg: '#EFF6FF', color: '#1D4ED8' },
  MATERIAL_EMPAQUE:   { bg: '#FFFBEB', color: '#B45309' },
  MATERIAL_ENVASE:    { bg: '#F0FDF4', color: '#15803D' },
  EXCIPIENTE:         { bg: '#F5F3FF', color: '#6D28D9' },
  PRINCIPIO_ACTIVO:   { bg: '#FEF2F2', color: '#B91C1C' },
}

function TipoMaterialBadge({ tipo }: { tipo: TipoMaterial }) {
  const cfg = TIPO_BADGE[tipo] ?? { bg: '#F1F5F9', color: '#64748B' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {TIPO_MATERIAL_LABELS[tipo] ?? tipo}
    </span>
  )
}

export function MaterialesList() {
  const [data, setData] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState<TipoMaterial | ''>('')
  const puedeEditar = usePuedeEditar('materiales')
  const cargar = () => materialesApi.listar().then(setData).finally(() => setLoading(false))
  useEffect(() => { cargar() }, [])

  const filtered = useMemo(
    () => tipoFiltro ? data.filter(m => m.tipo === tipoFiltro) : data,
    [data, tipoFiltro]
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>Filtrar por tipo</label>
        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value as TipoMaterial | '')}
          style={{ padding: '7px 10px', border: '1.5px solid var(--hair-2)', borderRadius: 'var(--r-sm)', fontSize: 13, fontFamily: 'var(--f-sans)', color: 'var(--ink)', background: '#fff', outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos los tipos</option>
          {TIPO_MATERIAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tipoFiltro && (
          <button onClick={() => setTipoFiltro('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 12 }}>
            <i className="fa fa-times" /> Limpiar
          </button>
        )}
      </div>
      <CatalogPage<Material>
        panelTitle="Lista de materiales"
        icon="fa-pills"
        description="Materias primas, productos y material de empaque/envase del catálogo"
        data={filtered}
        loading={loading}
        canCreate={puedeEditar}
        canEdit={puedeEditar}
        columns={[
          { key: 'codigo', header: 'Código', width: '15%', sortable: true },
          { key: 'descripcion', header: 'Descripción', sortable: true },
          { key: 'tipo', header: 'Tipo', width: '22%', render: (row: Material) => <TipoMaterialBadge tipo={row.tipo} /> },
        ]}
        fields={[
          { key: 'codigo', label: 'Código', required: true },
          { key: 'descripcion', label: 'Descripción', required: true },
          { key: 'tipo', label: 'Tipo', required: true, type: 'select', options: TIPO_MATERIAL_OPTIONS },
        ]}
        onSave={async (values, isEdit) => {
          const tipo = values.tipo as TipoMaterial
          if (isEdit) {
            const row = data.find(m => m.codigo === values.codigo)
            if (row) await materialesApi.actualizar(row.id, { descripcion: values.descripcion, tipo })
          } else {
            await materialesApi.crear({ codigo: values.codigo, descripcion: values.descripcion, tipo })
          }
          cargar()
        }}
        onDelete={async row => { await materialesApi.eliminar(row.id); cargar() }}
      />
    </>
  )
}

// ── Parámetros ────────────────────────────────────────────────────────────
export function ParametrosList() {
  const [data, setData] = useState<Parametro[]>([])
  const [loading, setLoading] = useState(true)
  const puedeEditar = usePuedeEditar('parametros')
  const cargar = () => parametrosApi.listar().then(setData).finally(() => setLoading(false))
  useEffect(() => { cargar() }, [])

  return (
    <CatalogPage<Parametro>
      panelTitle="Lista de parámetros"
      data={data}
      loading={loading}
      canCreate={puedeEditar}
      canEdit={puedeEditar}
      columns={[
        { key: 'nombre',      header: 'Nombre',      width: '25%' },
        { key: 'valor',       header: 'Valor',       width: '15%' },
        { key: 'descripcion', header: 'Descripción' },
      ]}
      fields={[
        { key: 'nombre',      label: 'Nombre',      required: true },
        { key: 'valor',       label: 'Valor',       required: true },
        { key: 'descripcion', label: 'Descripción' },
      ]}
      onSave={async (values, isEdit) => {
        if (isEdit) {
          const row = data.find(p => p.nombre === values.nombre)
          if (row) await parametrosApi.actualizar(row.id, values)
        } else {
          await parametrosApi.crear({ nombre: values.nombre, valor: values.valor, descripcion: values.descripcion })
        }
        cargar()
      }}
      onDelete={async row => { await parametrosApi.eliminar(row.id); cargar() }}
    />
  )
}
