import { useState } from 'react'
import { CatalogPage } from '@/components/shared/CatalogPage'
import { mockFirmas, mockGruposResponsables, getGrupoColor } from '@/api/mock'
import { GRUPOS } from '@/types'
import type { Firma } from '@/types'

// Options dynamically come from the configurable groups
const getGrupoOptions = () =>
  mockGruposResponsables.map(g => ({ value: String(g.id), label: g.nombre }))

export function FirmasList() {
  const [data, setData] = useState<Firma[]>(mockFirmas)

  return (
    <CatalogPage<Firma>
      panelTitle="Lista de firmas"
      data={data}
      columns={[
        { key: 'codigo',      header: 'Código',      width: '10%',
          render: r => <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600 }}>{r.codigo}</span> },
        { key: 'descripcion', header: 'Descripción', width: '22%' },
        { key: 'texto',       header: 'Texto' },
        { key: 'idGrupo',     header: 'Grupo',       width: '14%',
          render: r => {
            const nombre = GRUPOS[r.idGrupo]
            if (!nombre) return <span style={{ color: 'var(--ink-4)' }}>—</span>
            const c = getGrupoColor(nombre)
            return (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: c.bg, color: c.text, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                {nombre}
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
        { key: 'idGrupo',     label: 'Grupo responsable', required: true, type: 'select', options: getGrupoOptions() },
      ]}
      onSave={(values, isEdit) => {
        if (isEdit) {
          setData(d => d.map(f => f.codigo === values.codigo
            ? { ...f, descripcion: values.descripcion, texto: values.texto, idGrupo: Number(values.idGrupo) }
            : f
          ))
        } else {
          const newId = Math.max(0, ...data.map(f => f.idFirma)) + 1
          setData(d => [...d, { idFirma: newId, codigo: values.codigo, descripcion: values.descripcion, texto: values.texto, idGrupo: Number(values.idGrupo), activo: 1 }])
        }
      }}
      onDelete={row => setData(d => d.filter(f => f.idFirma !== row.idFirma))}
    />
  )
}
