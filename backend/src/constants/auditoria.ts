// Las únicas entidades de auditoría cuyo idEntidad es un idBatchRecord (ver logAudit en
// batchRecords.ts y desviaciones.ts). Se usa tanto para limitar la consulta de auditoría de un
// Batch Record puntual (sin esto, un idEntidad numérico también coincidiría con Sesion, Usuario,
// etc.) como para el cálculo de actividad reciente. El frontend tiene su propia copia en
// src/features/batch-record/EditarBatchRecord.tsx que debe mantenerse igual.
export const ENTIDADES_DE_BR: string[] = ['BatchRecord', 'DetalleValores', 'FirmaSeccion', 'FirmaCierre', 'Desviacion']
