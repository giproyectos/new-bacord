import { CatalogPage } from '@/components/shared/CatalogPage'
import { mockMateriales, type Material } from '@/api/mock'

// ── Materiales ────────────────────────────────────────────────────────────
export function MaterialesList() {
  return (
    <CatalogPage<Material>
      panelTitle="Lista de materiales"
      icon="fa-pills"
      description="Productos farmacéuticos del catálogo"
      data={mockMateriales}
      columns={[{ key: 'codigo', header: 'Código', width: '15%', sortable: true }, { key: 'descripcion', header: 'Descripción', sortable: true }]}
      fields={[{ key: 'codigo', label: 'Código', required: true }, { key: 'descripcion', label: 'Descripción', required: true }]}
      onSave={(values, isEdit) => {
        if (isEdit) {
          const i = mockMateriales.findIndex(m => m.codigo === values.codigo)
          if (i !== -1) mockMateriales[i] = { ...mockMateriales[i], descripcion: values.descripcion }
        } else {
          mockMateriales.push({ id: Math.max(0, ...mockMateriales.map(m => m.id)) + 1, codigo: values.codigo, descripcion: values.descripcion })
        }
      }}
    />
  )
}

// ── Parámetros ────────────────────────────────────────────────────────────
interface Parametro { id: number; nombre: string; valor: string; descripcion: string }
const mockParametros: Parametro[] = [
  { id: 1, nombre: 'ORGANIZACION_NOMBRE', valor: 'ZENTTRA',     descripcion: 'Nombre de la organización' },
  { id: 2, nombre: 'MOSTRAR_BANNER',      valor: '0',           descripcion: 'Mostrar banner en cabecera' },
  { id: 3, nombre: 'MOSTRAR_FOOTER',      valor: '1',           descripcion: 'Mostrar footer' },
]
export function ParametrosList() {
  return (
    <CatalogPage<Parametro>
      panelTitle="Lista de parámetros"
      data={mockParametros}
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
    />
  )
}

