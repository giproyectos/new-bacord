// Estados del ciclo de vida de una Receta Maestra — Creación → Revisión → Aprobado → Activo →
// Inactivo (o Revisión → Rechazado, de vuelta a Creación). Debe coincidir con
// TRANSICIONES_VALIDAS/ESTADO_LABEL en backend/src/routes/recetasMaestras.ts.
//
// Un solo lugar para esta etiqueta evita que quede desincronizada entre los distintos
// componentes que la muestran — antes src/api/recetaMaestra.ts tenía su propia copia, obsoleta,
// de solo 3 estados ('Borrador'/'Aprobada'/'Obsoleta'), que hacía que Fórmulas de Control y
// Órdenes de Proceso mostraran el estado real de la receta (ej. Aprobado) con una etiqueta
// equivocada (ej. "Obsoleta").
export const RECETA_ESTADO_LABEL: Record<number, string> = {
  1: 'Activo',
  2: 'Inactivo',
  3: 'Aprobado',
  4: 'Creación',
  5: 'Revisión',
  6: 'Rechazado',
}
