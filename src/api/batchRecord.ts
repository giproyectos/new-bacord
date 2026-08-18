import { delay, mockBatchRecords } from './mock'
import type { BatchRecord, BusquedaBatchRecord, Resultado } from '@/types'
export const batchRecordApi = {
  buscar: async (f?: BusquedaBatchRecord): Promise<BatchRecord[]> => {
    await delay()
    let d = [...mockBatchRecords]
    if (f?.idEstado) d = d.filter((b) => b.idEstado === f.idEstado)
    return d
  },
  find: async (id: number): Promise<BatchRecord> => {
    await delay()
    const item = mockBatchRecords.find((b) => b.idBatchRecord === id)
    if (!item) throw new Error('No encontrado')
    return item
  },
  guardar: async (data: Partial<BatchRecord>): Promise<Resultado> => {
    await delay(500); return { estado: true, mensaje: 'Guardado', datos: data }
  },
  validarFirma: async (_login: string, codigo: string): Promise<Resultado> => {
    await delay(600)
    if (codigo !== 'bacord2025') return { estado: false, mensaje: 'Código inválido' }
    return { estado: true, mensaje: 'Firma válida' }
  },
}
