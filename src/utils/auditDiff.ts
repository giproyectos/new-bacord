import type { AuditCambio } from '@/types/audit'

export function diffValores(
  anterior: Record<string, string>,
  nuevo: Record<string, string>,
  etiquetas: Record<string, string> = {}
): AuditCambio[] {
  const allKeys = new Set([...Object.keys(anterior), ...Object.keys(nuevo)])
  const cambios: AuditCambio[] = []
  for (const campo of allKeys) {
    const ant = anterior[campo] ?? ''
    const nv  = nuevo[campo] ?? ''
    if (ant !== nv) {
      cambios.push({ campo, etiqueta: etiquetas[campo] ?? campo, valorAnterior: ant, valorNuevo: nv })
    }
  }
  return cambios
}
