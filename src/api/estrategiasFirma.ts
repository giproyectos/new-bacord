import { http } from './http'
import type { EstrategiaFirma, EstrategiaFirmaItem, Resultado } from '@/types'

interface BackendItem {
  idFirma: number
  texto: string
  orden: number
  activo: boolean
  firma: { codigo: string; idGrupo: number; grupo?: { nombre: string } }
}
interface BackendEstrategia {
  id: number
  codigo: string
  descripcion: string
  activo: boolean
  usuarioCreacion: string
  fechaCreacion: string
  gruposDerogacion: string | null
  firmas: BackendItem[]
}

function toFrontend(e: BackendEstrategia): EstrategiaFirma {
  const firmas: EstrategiaFirmaItem[] = e.firmas.map((f) => ({
    idFirma: f.idFirma,
    codigo: f.firma.codigo,
    texto: f.texto,
    grupo: f.firma.grupo?.nombre ?? '',
    orden: f.orden,
    activo: f.activo,
  }))
  return {
    id: e.id,
    codigo: e.codigo,
    descripcion: e.descripcion,
    usuarioCreacion: e.usuarioCreacion,
    fechaCreacion: e.fechaCreacion,
    activo: e.activo ? 1 : 0,
    firmas,
    gruposDerogacion: e.gruposDerogacion ? e.gruposDerogacion.split(',').filter(Boolean) : [],
  }
}

export interface EstrategiaFirmaInput {
  codigo: string
  descripcion: string
  gruposDerogacion?: string[]
  firmas: { idFirma: number; texto: string; orden: number }[]
}

export const estrategiasFirmaApi = {
  listar: async (): Promise<EstrategiaFirma[]> => {
    const { data } = await http.get<BackendEstrategia[]>('/estrategias-firma')
    return data.map(toFrontend)
  },
  crear: async (data: EstrategiaFirmaInput): Promise<Resultado<EstrategiaFirma>> => {
    const { data: res } = await http.post<Resultado<BackendEstrategia>>('/estrategias-firma', data)
    return { ...res, datos: res.datos ? toFrontend(res.datos) : undefined }
  },
  actualizar: async (id: number, data: Partial<EstrategiaFirmaInput>): Promise<Resultado<EstrategiaFirma>> => {
    const { data: res } = await http.put<Resultado<BackendEstrategia>>(`/estrategias-firma/${id}`, data)
    return { ...res, datos: res.datos ? toFrontend(res.datos) : undefined }
  },
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/estrategias-firma/${id}`)).data,
}
