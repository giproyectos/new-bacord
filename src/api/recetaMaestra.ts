import { http } from './http'
import type { RecetaMaestra, BusquedaRecetaMaestra, Resultado } from '@/types'

const ESTADO_LABEL: Record<number, string> = { 1: 'Borrador', 2: 'Aprobada', 3: 'Obsoleta' }

interface BackendReceta {
  idRecetaMaestra: number
  codigo: string
  descripcion: string
  version: string
  idCentro: number
  centro: { codigo: string; descripcion: string }
  idEstado: number
  idMaterial: number
  material: { id: number; codigo: string; descripcion: string }
  motivo: string | null
  usuarioCreacion: string
  fechaCreacion: string
  usuarioModificacion: string
  fechaModificacion: string
  procesos: { proceso: { descripcion: string } }[]
}

function toFrontend(r: BackendReceta): RecetaMaestra {
  return {
    idRecetaMaestra: r.idRecetaMaestra,
    codigo: r.codigo,
    descripcion: r.descripcion,
    version: r.version,
    idCentro: r.idCentro,
    centro: r.centro?.descripcion ?? '',
    idEstado: r.idEstado,
    estado: ESTADO_LABEL[r.idEstado] ?? '—',
    procesos: r.procesos?.map((p) => p.proceso.descripcion).join(', ') ?? '',
    materiales: r.material?.descripcion ?? '',
    idMateriales: r.idMaterial ? String(r.idMaterial) : '',
    motivo: r.motivo ?? '',
    usuarioCreacion: r.usuarioCreacion,
    fechaCreacion: r.fechaCreacion,
    usuarioModificacion: r.usuarioModificacion,
    fechaModificacion: r.fechaModificacion,
  }
}

export interface RecetaMaestraInput {
  codigo: string
  descripcion: string
  version: string
  idCentro: number
  idMaterial: number
  motivo?: string
}

export interface RecetaEstructuraDetalle {
  id: number
  idRecetaProceso: number
  idDetalle: number
  orden: number
  detalle: { id: number; codigo: string; descripcion: string; idEstrategiaFirma: number | null }
}
export interface RecetaEstructuraProceso {
  id: number
  idRecetaMaestra: number
  idProceso: number
  orden: number
  proceso: { id: number; codigo: string; descripcion: string }
  detalles: RecetaEstructuraDetalle[]
}
export interface RecetaEstructuraResponse {
  idRecetaMaestra: number
  procesos: RecetaEstructuraProceso[]
}

export const recetaMaestraApi = {
  buscar: async (f?: BusquedaRecetaMaestra): Promise<RecetaMaestra[]> => {
    const { data } = await http.get<BackendReceta[]>('/recetas-maestras', { params: f })
    return data.map(toFrontend)
  },
  find: async (id: number): Promise<RecetaMaestra> => {
    const { data } = await http.get<BackendReceta>(`/recetas-maestras/${id}`)
    return toFrontend(data)
  },
  crear: async (data: RecetaMaestraInput): Promise<Resultado<RecetaMaestra>> => {
    const { data: res } = await http.post<Resultado<BackendReceta>>('/recetas-maestras', data)
    return { ...res, datos: res.datos ? toFrontend(res.datos) : undefined }
  },
  guardar: async (id: number, data: Partial<RecetaMaestraInput>): Promise<Resultado<RecetaMaestra>> => {
    const { data: res } = await http.put<Resultado<BackendReceta>>(`/recetas-maestras/${id}`, data)
    return { ...res, datos: res.datos ? toFrontend(res.datos) : undefined }
  },
  cambiarEstado: async (id: number, idEstado: number, motivo: string): Promise<Resultado> =>
    (await http.post<Resultado>(`/recetas-maestras/${id}/estado`, { idEstado, motivo })).data,
  copiar: async (id: number, codigo: string): Promise<Resultado> =>
    (await http.post<Resultado>(`/recetas-maestras/${id}/copiar`, { codigo })).data,
  getEstructura: async (id: number): Promise<RecetaEstructuraResponse> =>
    (await http.get<RecetaEstructuraResponse>(`/recetas-maestras/${id}/estructura`)).data,
  guardarEstructura: async (id: number, procesos: { idProceso: number; orden: number; detalles: { idDetalle: number; orden: number }[] }[]) =>
    (await http.put(`/recetas-maestras/${id}/estructura`, { procesos })).data,
}
