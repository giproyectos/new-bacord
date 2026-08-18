import { EditarBatchRecord } from './EditarBatchRecord'

// La vista de consulta es igual a la de edición pero en modo readonly
// (los botones de firma y cierre están deshabilitados)
export function ConsultarBatchRecord() {
  return <EditarBatchRecord readonly />
}
