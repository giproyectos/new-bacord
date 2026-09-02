import { useEffect, useState } from 'react'
import { CatalogPage } from '@/components/shared/CatalogPage'
import { firmasApi, type FirmaApi } from '@/api/firmas'
import { gruposResponsablesApi } from '@/api/gruposResponsables'
import { colorForKey } from '@/utils/colorPalette'
import { usePuedeEditar } from '@/hooks/usePermisos'
import type { GrupoResponsable } from '@/types'

export function FirmasList() {
  const [data, setData] = useState<FirmaApi[]>([])
  const [grupos, setGrupos] = useState<GrupoResponsable[]>([])
  const [loading, setLoading] = useState(true)
  const puedeEditar = usePuedeEditar('firmas')

  const cargar = () => Promise.all([firmasApi.listar(), gruposResponsablesApi.listar()]).then(([firmas, gs]) => {
    setData(firmas)
    setGrupos(gs)
  }).finally(() => setLoading(false))
  useEffect(() => { cargar() }, [])

  const grupoOptions = grupos.map(g => ({ value: String(g.id), label: g.nombre }))

  return (
    <CatalogPage<FirmaApi>
      panelTitle="Lista de firmas"
      data={data}
      loading={loading}
      canCreate={puedeEditar}
      canEdit={puedeEditar}
      columns={[
        { key: 'codigo',      header: 'Código',      width: '10%',
          render: r => <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600 }}>{r.codigo}</span> },
        { key: 'descripcion', header: 'Descripción', width: '22%' },
        { key: 'texto',       header: 'Texto' },
        { key: 'idGrupo',     header: 'Grupo',       width: '14%',
          render: r => {
            if (!r.grupo) return <span style={{ color: 'var(--ink-4)' }}>—</span>
            const c = colorForKey(r.grupo.colorKey)
            return (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: c.bg, color: c.text, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                {r.grupo.nombre}
              </span>
            )
          },
        },
        { key: 'activo', header: 'Activo', width: '7%',
          render: r => <span style={{ fontSize: 12, fontWeight: 600, color: r.activo ? 'var(--forest)' : 'var(--ink-4)' }}>{r.activo ? 'Sí' : 'No'}</span>
        },
      ]}
      fields={[
        { key: 'codigo',      label: 'Código',            required: true },
        { key: 'descripcion', label: 'Descripción',       required: true },
        { key: 'texto',       label: 'Texto de la firma', required: true },
        { key: 'idGrupo',     label: 'Grupo responsable', required: true, type: 'select', options: grupoOptions },
      ]}
      onSave={async (values, isEdit) => {
        if (isEdit) {
          const row = data.find(f => f.codigo === values.codigo)
          if (row) await firmasApi.actualizar(row.idFirma, { descripcion: values.descripcion, texto: values.texto, idGrupo: Number(values.idGrupo) })
        } else {
          await firmasApi.crear({ codigo: values.codigo, descripcion: values.descripcion, texto: values.texto, idGrupo: Number(values.idGrupo) })
        }
        cargar()
      }}
      onDelete={async row => { await firmasApi.eliminar(row.idFirma); cargar() }}
    />
  )
}
