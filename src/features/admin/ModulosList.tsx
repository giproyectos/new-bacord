import { CatalogPage } from '@/components/shared/CatalogPage'

interface Modulo { id: number; nombre: string; descripcion: string; nombreRoute: string; icono: string; orden: number }

const mock: Modulo[] = [
  { id: 1, nombre: 'Operación',      descripcion: 'Módulo de operación',      nombreRoute: '',              icono: 'fa-cogs',     orden: 1 },
  { id: 2, nombre: 'Fórmulas Control', descripcion: 'Gestión de fórmulas',   nombreRoute: 'FormulasControl', icono: 'fa-flask',   orden: 1 },
  { id: 3, nombre: 'Batch Record',   descripcion: 'Registro de lotes',        nombreRoute: 'BatchRecord',   icono: 'fa-list-alt', orden: 2 },
  { id: 4, nombre: 'Administración', descripcion: 'Módulo administrativo',    nombreRoute: '',              icono: 'fa-wrench',   orden: 2 },
  { id: 5, nombre: 'Usuarios',       descripcion: 'Gestión de usuarios',      nombreRoute: 'Usuarios',      icono: 'fa-users',    orden: 1 },
]

export function ModulosList() {
  return (
    <CatalogPage<Modulo>
      panelTitle="Lista de módulos"
      data={mock}
      columns={[
        { key: 'nombre',       header: 'Nombre' },
        { key: 'descripcion',  header: 'Descripción' },
        { key: 'nombreRoute',  header: 'Route',       width: '14%' },
        { key: 'icono',        header: 'Ícono',       width: '12%' },
        { key: 'orden',        header: 'Orden',       width: '7%', align: 'center' },
      ]}
      fields={[
        { key: 'nombre',      label: 'Nombre',      required: true },
        { key: 'descripcion', label: 'Descripción', required: true },
        { key: 'nombreRoute', label: 'Route' },
        { key: 'icono',       label: 'Ícono (clase FA)' },
      ]}
    />
  )
}
