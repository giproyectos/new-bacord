import { useEffect, useMemo, useState } from 'react'
import { CatalogPage } from '@/components/shared/CatalogPage'
import { materialesApi, TIPO_MATERIAL_LABELS, type Material, type TipoMaterial } from '@/api/materiales'
import { parametrosApi, type Parametro } from '@/api/parametros'
import { gruposResponsablesApi } from '@/api/gruposResponsables'
import type { GrupoResponsable } from '@/types'
import { usePuedeEditar } from '@/hooks/usePermisos'
import { useAuthStore } from '@/stores/authStore'

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
        onSave={async (values, isEdit, row) => {
          const tipo = values.tipo as TipoMaterial
          if (isEdit) {
            // `row` es la fila que se abrió para editar — buscarla en `data` por `values.codigo` (como
            // antes) fallaba en silencio si el usuario cambiaba el código, porque ese valor ya no
            // coincidía con ninguna fila existente.
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

// ── Parámetros / Permisos ────────────────────────────────────────────────────
// "Quién puede hacer X" (cancelar un lote, liberarlo, cerrar una desviación) se guarda como un
// Parámetro más — un CSV de nombres de Grupo Responsable —, pero escribir esos nombres a mano en
// una casilla de texto genérica no es intuitivo: no muestra qué grupos existen de verdad, y es
// fácil escribir uno mal. Este control reutiliza la misma idea que ya funciona en Estrategias de
// Firma ("Grupos que pueden derogar"): una lista de chips alimentada de los Grupos Responsables
// reales, que guarda sola al marcar/desmarcar — sin un botón de "Guardar" aparte.
function PermisoPorGrupo({ nombreParametro, titulo, descripcion, grupos, parametro, onGuardado }: {
  nombreParametro: string
  titulo: string
  descripcion: string
  grupos: GrupoResponsable[]
  parametro: Parametro | undefined
  onGuardado: (p: Parametro) => void
}) {
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const seleccionados = (parametro?.valor ?? '').split(',').map(s => s.trim()).filter(Boolean)

  const toggle = async (nombreGrupo: string) => {
    const nuevo = seleccionados.includes(nombreGrupo)
      ? seleccionados.filter(g => g !== nombreGrupo)
      : [...seleccionados, nombreGrupo]
    setGuardando(nombreGrupo)
    setError('')
    try {
      // Si el Parámetro todavía no existe en esta base (una instalación que no corrió el seed
      // más reciente), se crea la primera vez que se marca un grupo, en vez de fallar.
      const res = parametro
        ? await parametrosApi.actualizar(parametro.id, { valor: nuevo.join(',') })
        : await parametrosApi.crear({ nombre: nombreParametro, valor: nuevo.join(','), descripcion })
      if (res.estado && res.datos) onGuardado(res.datos)
      else if (!res.estado) setError(res.mensaje)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div style={{ border: '1.5px solid var(--hair-2)', borderRadius: 'var(--r-md)', padding: '16px 18px', marginBottom: 14, background: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 12 }}>
        Además de los administradores, que siempre pueden: {descripcion}
      </div>
      {grupos.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>No hay Grupos Responsables activos configurados.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {grupos.map(g => {
            const activo = seleccionados.includes(g.nombre)
            return (
              <label key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px',
                borderRadius: 20, border: `1.5px solid ${activo ? 'var(--navy)' : 'var(--hair-2)'}`,
                background: activo ? 'rgba(10,45,99,.06)' : '#fff', cursor: guardando ? 'wait' : 'pointer',
                fontSize: 13, color: activo ? 'var(--navy)' : 'var(--ink-2)', fontWeight: activo ? 600 : 500,
                opacity: guardando && guardando !== g.nombre ? 0.5 : 1, transition: 'opacity 120ms',
              }}>
                <input type="checkbox" checked={activo} disabled={guardando !== null}
                  onChange={() => toggle(g.nombre)}
                  style={{ accentColor: 'var(--navy)', width: 14, height: 14 }} />
                {guardando === g.nombre ? <i className="fa fa-spinner fa-spin" style={{ fontSize: 11 }} /> : g.nombre}
              </label>
            )
          })}
        </div>
      )}
      {error && <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626' }}>{error}</div>}
      {seleccionados.length === 0 && !error && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#92400E', background: '#FFFBEB',
          border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 10px' }}>
          <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
          Sin ningún grupo marcado, solo los administradores pueden hacerlo.
        </div>
      )}
    </div>
  )
}

export function ParametrosList() {
  const esAdmin = useAuthStore((s) => !!s.user?.esAdministrador)
  const [tab, setTab] = useState<'parametros' | 'permisos'>('permisos')
  const [data, setData] = useState<Parametro[]>([])
  const [grupos, setGrupos] = useState<GrupoResponsable[]>([])
  const [loading, setLoading] = useState(true)
  const cargar = () => Promise.all([parametrosApi.listar(), gruposResponsablesApi.listar()])
    .then(([ps, gs]) => { setData(ps); setGrupos(gs) })
    .finally(() => setLoading(false))
  // Los parámetros son solo para administradores: un no-admin no debe llamar a la API (daría 403
  // y la pantalla se vería como una lista vacía en vez de explicar por qué no hay datos).
  useEffect(() => { if (esAdmin) cargar(); else setLoading(false) }, [esAdmin])

  if (!esAdmin) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
      <i className="fa fa-lock" style={{ marginRight: 8 }} />
      Los parámetros del sistema solo puede verlos un administrador.
    </div>
  )

  const porNombre = (nombre: string) => data.find(p => p.nombre === nombre)
  const actualizarLocal = (p: Parametro) => setData(ds => {
    const idx = ds.findIndex(d => d.id === p.id || d.nombre === p.nombre)
    if (idx === -1) return [...ds, p]
    const copia = [...ds]; copia[idx] = p; return copia
  })
  const gruposActivos = grupos.filter(g => g.activo)

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1.5px solid var(--hair-2)' }}>
        {([
          { id: 'permisos' as const,   label: 'Permisos' },
          { id: 'parametros' as const, label: 'Parámetros' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600, marginBottom: -1.5,
            color: tab === t.id ? 'var(--navy)' : 'var(--ink-4)',
            borderBottom: tab === t.id ? '2.5px solid var(--navy)' : '2.5px solid transparent',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'permisos' ? (
        loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}>Cargando…</div>
        ) : (
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 16, maxWidth: 640 }}>
              Elige qué Grupos Responsables tienen cada permiso. La lista de grupos sale de{' '}
              <strong>Grupos Responsables</strong> — crea o activa uno ahí si no aparece aquí.
            </div>
            <PermisoPorGrupo
              nombreParametro="batch_records_grupo_cancelar"
              titulo="¿Quién puede cancelar un Batch Record?"
              descripcion="estos grupos podrán cancelar un lote en tratamiento o finalizado."
              grupos={gruposActivos}
              parametro={porNombre('batch_records_grupo_cancelar')}
              onGuardado={actualizarLocal}
            />
            <PermisoPorGrupo
              nombreParametro="batch_records_grupo_liberar"
              titulo="¿Quién puede liberar un Batch Record?"
              descripcion="estos grupos podrán liberar un lote ya Finalizado (todas sus firmas de cierre completas)."
              grupos={gruposActivos}
              parametro={porNombre('batch_records_grupo_liberar')}
              onGuardado={actualizarLocal}
            />
            <PermisoPorGrupo
              nombreParametro="desviaciones_grupo_cierre"
              titulo="¿Quién puede cerrar una desviación?"
              descripcion="estos grupos podrán cerrar una desviación reportada en un Batch Record."
              grupos={gruposActivos}
              parametro={porNombre('desviaciones_grupo_cierre')}
              onGuardado={actualizarLocal}
            />
          </div>
        )
      ) : (
        <CatalogPage<Parametro>
          panelTitle="Lista de parámetros"
          data={data}
          loading={loading}
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
          onSave={async (values, isEdit, row) => {
            // `row` es la fila que se abrió para editar — buscarla en `data` por `values.nombre`
            // (como antes) fallaba en silencio si el usuario cambiaba el nombre, porque ese valor
            // ya no coincidía con ninguna fila existente.
            if (isEdit) {
              if (row) await parametrosApi.actualizar(row.id, values)
            } else {
              await parametrosApi.crear({ nombre: values.nombre, valor: values.valor, descripcion: values.descripcion })
            }
            cargar()
          }}
          onDelete={async row => { await parametrosApi.eliminar(row.id); cargar() }}
        />
      )}
    </>
  )
}
