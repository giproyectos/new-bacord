import { delay, mockOrdenes, mockComponentes, mockCarguesOP } from './mock'
import type { OrdenProceso, ComponenteOrden, CargueRegistro, BusquedaOrdenProceso, Resultado } from '@/types'

export const ordenProcesoApi = {
  buscar: async (f?: BusquedaOrdenProceso): Promise<OrdenProceso[]> => {
    await delay()
    let d = [...mockOrdenes]
    if (f?.numeroOrden) d = d.filter((o) => o.numeroOrdenProceso.includes(f.numeroOrden!))
    if (f?.codigoMaterial) d = d.filter((o) => o.codigoMaterial.includes(f.codigoMaterial!))
    if (f?.idEstado) d = d.filter((o) => o.idEstado === f.idEstado)
    return d
  },

  find: async (id: number): Promise<OrdenProceso> => {
    await delay()
    const item = mockOrdenes.find((o) => o.idOrdenProceso === id)
    if (!item) throw new Error('No encontrada')
    return item
  },

  getComponentes: async (idOrdenProceso: number): Promise<ComponenteOrden[]> => {
    await delay(300)
    return mockComponentes.filter((c) => c.idOrdenProceso === idOrdenProceso)
  },

  guardar: async (data: Partial<OrdenProceso>): Promise<Resultado> => {
    await delay(500)
    return { estado: true, mensaje: 'Guardada', datos: data }
  },

  confirmarCargue: async (
    ordenes: Omit<OrdenProceso, 'idOrdenProceso'>[],
    componentes: Omit<ComponenteOrden, 'idComponente' | 'idOrdenProceso'>[][]
  ): Promise<Resultado<{ totalCargadas: number; totalComponentes: number }>> => {
    await delay(1200)
    const baseId = mockOrdenes.length + 1
    ordenes.forEach((op, idx) => {
      const nuevoId = baseId + idx
      const nueva: OrdenProceso = { idOrdenProceso: nuevoId, ...op }
      mockOrdenes.push(nueva)
      componentes[idx]?.forEach((comp, ci) => {
        mockComponentes.push({
          idComponente: mockComponentes.length + ci + 1,
          idOrdenProceso: nuevoId,
          ...comp,
        })
      })
    })
    return {
      estado: true,
      mensaje: `${ordenes.length} órdenes cargadas correctamente`,
      datos: {
        totalCargadas: ordenes.length,
        totalComponentes: componentes.flat().length,
      },
    }
  },

  buscarCargues: async (): Promise<CargueRegistro[]> => {
    await delay(300)
    return [...mockCarguesOP]
  },
}
