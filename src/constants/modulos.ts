export const MODULOS = [
  { clave: 'batch-records',       label: 'Batch Records' },
  { clave: 'ordenes-proceso',     label: 'Órdenes de Proceso' },
  { clave: 'formulas-control',    label: 'Fórmulas de Control' },
  { clave: 'firmas',              label: 'Firmas' },
  { clave: 'estrategias-firma',   label: 'Estrategias de Firma' },
  { clave: 'recetas-maestras',    label: 'Recetas Maestras' },
  { clave: 'materiales',          label: 'Materiales' },
  { clave: 'procesos',            label: 'Procesos' },
  { clave: 'parametros',          label: 'Parámetros' },
  { clave: 'centros',             label: 'Centros' },
  { clave: 'grupos-responsables', label: 'Grupos Responsables' },
  { clave: 'detalles',            label: 'Formularios' },
  { clave: 'auditoria',           label: 'Auditoría' },
] as const

export type ModuloClave = (typeof MODULOS)[number]['clave']
