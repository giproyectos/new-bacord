import { delay, mockFormulasControl, mockOrdenes, mockComponentes, mockBatchRecords, mockPreLlenados } from './mock'
import type { FormulaControl, BatchRecord, PreLlenadoBR } from '@/types'

const nextId = (arr: { [k: string]: number }[], key: string) =>
  arr.length ? Math.max(...arr.map(x => x[key] as number)) + 1 : 1

export const formulaControlApi = {
  buscar: async (): Promise<FormulaControl[]> => {
    await delay()
    return [...mockFormulasControl]
  },

  find: async (id: number): Promise<FormulaControl> => {
    await delay(300)
    const fc = mockFormulasControl.find(f => f.idFormulaControl === id)
    if (!fc) throw new Error('FC no encontrada')
    return { ...fc }
  },

  crear: async (idOrdenProceso: number): Promise<FormulaControl> => {
    await delay(600)
    const op = mockOrdenes.find(o => o.idOrdenProceso === idOrdenProceso)
    if (!op) throw new Error('Orden de proceso no encontrada')

    const activa = mockFormulasControl.find(f => f.idOrdenProceso === idOrdenProceso && f.idEstado !== 3)
    if (activa) throw new Error('Ya existe una Fórmula de Control activa para esta Orden de Proceso')

    const nueva: FormulaControl = {
      idFormulaControl: nextId(mockFormulasControl as unknown as { [k: string]: number }[], 'idFormulaControl'),
      idRecetaMaestra: op.idRecetaMaestra,
      idOrdenProceso,
      motivoEstado: '',
      idEstado: 1,
      idCentro: op.idCentro,
      idUsuarioCreacion: 1,
      fechaCreacion: new Date().toISOString(),
    }
    mockFormulasControl.push(nueva)
    op.idEstado = 2
    return { ...nueva }
  },

  enviar: async (idFormulaControl: number): Promise<BatchRecord> => {
    await delay(800)
    const fc = mockFormulasControl.find(f => f.idFormulaControl === idFormulaControl)
    if (!fc) throw new Error('FC no encontrada')

    fc.idEstado = 2

    const newBrId = nextId(mockBatchRecords as unknown as { [k: string]: number }[], 'idBatchRecord')
    const br: BatchRecord = {
      idBatchRecord: newBrId,
      idFormulaControl: fc.idFormulaControl,
      idRecetaMaestra: fc.idRecetaMaestra,
      idOrdenProceso: fc.idOrdenProceso,
      motivoEstado: '',
      idEstado: 1,
      idCentro: fc.idCentro,
      idUsuarioCreacion: 1,
      fechaCreacion: new Date().toISOString(),
      idUsuarioModificacion: 1,
      fechaModificacion: new Date().toISOString(),
      porcentajeAvance: 0,
    }
    mockBatchRecords.push(br)

    const op = mockOrdenes.find(o => o.idOrdenProceso === fc.idOrdenProceso)
    if (op) {
      op.idEstado = 3
      const comps = mockComponentes.filter(c => c.idOrdenProceso === op.idOrdenProceso)
      const preLlenado: PreLlenadoBR = {
        idBatchRecord: newBrId,
        numeroOrdenProceso: op.numeroOrdenProceso,
        codigoMaterial: op.codigoMaterial,
        descripcionMaterial: op.descripcionMaterial,
        loteLogistico: op.loteLogistico,
        loteInspeccion: op.loteInspeccion,
        fechaFabricacion: op.fechaFabricacion,
        fechaCaducidad: op.fechaCaducidad,
        registroSanitario: op.registroSanitario,
        formaFarmaceutica: op.formaFarmaceutica,
        cantidadOrden: op.cantidadOrden,
        unidadMedida: op.unidadMedida,
        centro: op.centro,
        componentes: comps,
      }
      mockPreLlenados.push(preLlenado)
    }

    return { ...br }
  },

  cancelar: async (idFormulaControl: number): Promise<void> => {
    await delay(400)
    const fc = mockFormulasControl.find(f => f.idFormulaControl === idFormulaControl)
    if (fc) {
      fc.idEstado = 3
      const op = mockOrdenes.find(o => o.idOrdenProceso === fc.idOrdenProceso)
      if (op) op.idEstado = 1
    }
  },

  getPreLlenado: async (idBatchRecord: number): Promise<PreLlenadoBR | null> => {
    await delay(200)
    return mockPreLlenados.find(p => p.idBatchRecord === idBatchRecord) ?? null
  },
}
