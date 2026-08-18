import { delay, mockRecetas } from './mock'
import type { RecetaMaestra, BusquedaRecetaMaestra, Resultado } from '@/types'
export const recetaMaestraApi = {
  buscar: async (f?: BusquedaRecetaMaestra): Promise<RecetaMaestra[]> => {
    await delay()
    let d = [...mockRecetas]
    if (f?.codigo) d = d.filter((r) => r.codigo.toLowerCase().includes(f.codigo!.toLowerCase()))
    if (f?.idEstado) d = d.filter((r) => r.idEstado === f.idEstado)
    return d
  },
  find: async (id: number): Promise<RecetaMaestra> => {
    await delay()
    const item = mockRecetas.find((r) => r.idRecetaMaestra === id)
    if (!item) throw new Error('No encontrada')
    return item
  },
  guardar: async (data: Partial<RecetaMaestra>): Promise<Resultado> => {
    await delay(500); return { estado: true, mensaje: 'Guardada', datos: data }
  },
  cambiarEstado: async (id: number, idEstado: number, motivo: string): Promise<Resultado> => {
    await delay(400); return { estado: true, mensaje: 'Estado actualizado', datos: { id, idEstado, motivo } }
  },
  copiar: async (id: number, codigo: string): Promise<Resultado> => {
    await delay(600); return { estado: true, mensaje: `Copiada como ${codigo}`, datos: { id, codigo } }
  },
}
