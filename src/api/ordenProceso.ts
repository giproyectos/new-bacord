import { http } from './http'
import type { OrdenProceso, ComponenteOrden, CargueRegistro, BusquedaOrdenProceso, Resultado } from '@/types'

export const ordenProcesoApi = {
  buscar: async (f?: BusquedaOrdenProceso): Promise<OrdenProceso[]> =>
    (await http.get<OrdenProceso[]>('/ordenes-proceso', { params: f })).data,

  find: async (id: number): Promise<OrdenProceso> => (await http.get<OrdenProceso>(`/ordenes-proceso/${id}`)).data,

  getComponentes: async (idOrdenProceso: number): Promise<ComponenteOrden[]> =>
    (await http.get<ComponenteOrden[]>(`/ordenes-proceso/${idOrdenProceso}/componentes`)).data,

  guardar: async (data: Partial<OrdenProceso> & { componentes?: Omit<ComponenteOrden, 'idComponente' | 'idOrdenProceso'>[] }): Promise<Resultado> =>
    (await http.post<Resultado>('/ordenes-proceso', data)).data,

  confirmarCargue: async (
    archivo: string,
    ordenes: Omit<OrdenProceso, 'idOrdenProceso'>[],
    componentes: Omit<ComponenteOrden, 'idComponente' | 'idOrdenProceso'>[][]
  ): Promise<Resultado<{ totalCargadas: number; totalComponentes: number; errores: number }>> =>
    (await http.post('/ordenes-proceso/cargue', { archivo, ordenes, componentes })).data,

  buscarCargues: async (): Promise<CargueRegistro[]> => (await http.get<CargueRegistro[]>('/ordenes-proceso/cargues')).data,
}
