// Estado de una Orden de Proceso — actualizado por backend/src/routes/formulasControl.ts al
// crear, enviar o cancelar una Fórmula de Control (ver backend/src/routes/ordenesProceso.ts y
// el comentario de idEstado en prisma/schema.prisma). 1 = recién creada, sin Fórmula de Control
// todavía; 2 = ya tiene una Fórmula de Control asociada; 3 = ya tiene un Batch Record (en
// cualquier estado — en tratamiento o liberado —, no necesariamente cerrado).
//
// Un solo lugar para esta etiqueta evita que quede desincronizada entre los componentes que la
// muestran — antes OrdenProcesoList.tsx y OrdenProcesoDetalle.tsx mostraban "Liberada" para el
// estado 1 (recién creada, sin nada hecho todavía) y "Cerrada" para el estado 3 (que solo
// significa que ya existe un Batch Record, no que haya terminado).
export const ORDEN_PROCESO_ESTADO_LABEL: Record<number, string> = {
  1: 'Pendiente',
  2: 'En Fórmula de Control',
  3: 'En Batch Record',
}
