import { http } from './http'
import type { Resultado } from '@/types'

export type TipoMaterial = 'PRODUCTO_TERMINADO' | 'MATERIAL_EMPAQUE' | 'MATERIAL_ENVASE' | 'EXCIPIENTE' | 'PRINCIPIO_ACTIVO'

export const TIPO_MATERIAL_LABELS: Record<TipoMaterial, string> = {
  PRODUCTO_TERMINADO: 'Producto Terminado',
  MATERIAL_EMPAQUE: 'Material de Empaque',
  MATERIAL_ENVASE: 'Material de Envase',
  EXCIPIENTE: 'Excipiente (Semiterminado/Granel)',
  PRINCIPIO_ACTIVO: 'Principio Activo (Semiterminado/Granel)',
}

export interface Material {
  id: number
  codigo: string
  descripcion: string
  tipo: TipoMaterial
  activo: boolean
}

export interface CargueMaterialRegistro {
  id: number
  archivo: string
  fechaCargue: string
  usuario: string
  totalMateriales: number
  errores: number
  estado: 'Exitoso' | 'Con errores' | 'Fallido'
}

export const materialesApi = {
  listar: async (tipo?: TipoMaterial): Promise<Material[]> =>
    (await http.get<Material[]>('/materiales', { params: tipo ? { tipo } : undefined })).data,
  crear: async (data: Omit<Material, 'id' | 'activo'>): Promise<Resultado<Material>> =>
    (await http.post<Resultado<Material>>('/materiales', data)).data,
  actualizar: async (id: number, data: Partial<Omit<Material, 'id'>>): Promise<Resultado<Material>> =>
    (await http.put<Resultado<Material>>(`/materiales/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/materiales/${id}`)).data,
  cargar: async (archivo: string, materiales: { codigo: string; descripcion: string; tipo: TipoMaterial }[]):
    Promise<Resultado<{ total: number; creados: number; errores: number }>> =>
    (await http.post('/materiales/cargue', { archivo, materiales })).data,
  buscarCargues: async (): Promise<CargueMaterialRegistro[]> =>
    (await http.get<CargueMaterialRegistro[]>('/materiales/cargues')).data,
}
