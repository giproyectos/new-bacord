import { http } from './http'
import type { FormulaControl, BatchRecord } from '@/types'

export const formulaControlApi = {
  buscar: async (): Promise<FormulaControl[]> => (await http.get<FormulaControl[]>('/formulas-control')).data,
  find: async (id: number): Promise<FormulaControl> => (await http.get<FormulaControl>(`/formulas-control/${id}`)).data,
  crear: async (idOrdenProceso: number): Promise<FormulaControl> =>
    (await http.post<FormulaControl>('/formulas-control', { idOrdenProceso })).data,
  enviar: async (idFormulaControl: number): Promise<BatchRecord> =>
    (await http.post<BatchRecord>(`/formulas-control/${idFormulaControl}/enviar`)).data,
  cancelar: async (idFormulaControl: number): Promise<void> => {
    await http.post(`/formulas-control/${idFormulaControl}/cancelar`)
  },
}
