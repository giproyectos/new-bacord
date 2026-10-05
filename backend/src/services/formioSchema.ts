/** Busca un componente `firma-seccion` por su `key` dentro de un schema Form.io y devuelve su idEstrategiaFirma. */
export function findFirmaSeccionEstrategia(jsonSchema: string, blockKey: string): number | null {
  try {
    const schema = JSON.parse(jsonSchema) as { components?: unknown[] }
    let found: number | null = null
    const walk = (comps: unknown[]) => {
      for (const raw of comps) {
        const c = raw as Record<string, unknown>
        if (c.type === 'firma-seccion' && c.key === blockKey) {
          found = typeof c.idEstrategiaFirma === 'number' ? c.idEstrategiaFirma : null
        }
        if (Array.isArray(c.components)) walk(c.components)
      }
    }
    if (Array.isArray(schema.components)) walk(schema.components)
    return found
  } catch {
    return null
  }
}

// Límites numéricos declarados en el schema — misma regla que usa el navegador (render.html,
// extractLimits): un componente con validate.min/max, y minOp/maxOp '>' o '<' para hacer el
// límite estricto. Recorre components y columns igual que el navegador.
export interface LimiteNumerico {
  campo: string
  etiqueta: string
  min: number | null
  max: number | null
  minStrict: boolean
  maxStrict: boolean
}

export function limitesNumericos(jsonSchema: string): LimiteNumerico[] {
  const out: LimiteNumerico[] = []
  try {
    const schema = JSON.parse(jsonSchema) as { components?: unknown[] }
    const walk = (comps: unknown[]) => {
      for (const raw of comps) {
        const c = raw as Record<string, unknown> & { validate?: Record<string, unknown> }
        if (c.validate) {
          const hasMin = c.validate.min !== undefined && c.validate.min !== null
          const hasMax = c.validate.max !== undefined && c.validate.max !== null
          if ((hasMin || hasMax) && typeof c.key === 'string') {
            out.push({
              campo: c.key,
              etiqueta: typeof c.label === 'string' && c.label ? c.label : c.key,
              min: hasMin ? Number(c.validate.min) : null,
              max: hasMax ? Number(c.validate.max) : null,
              minStrict: c.minOp === '>',
              maxStrict: c.maxOp === '<',
            })
          }
        }
        if (Array.isArray(c.components)) walk(c.components)
        if (Array.isArray(c.columns)) {
          for (const col of c.columns as Record<string, unknown>[]) {
            if (Array.isArray(col.components)) walk(col.components)
          }
        }
      }
    }
    if (Array.isArray(schema.components)) walk(schema.components)
  } catch {
    return []
  }
  return out
}

// Valores guardados que caen fuera de sus límites. Un valor vacío o no numérico no se evalúa.
export function valoresFueraDeRango(
  limites: LimiteNumerico[],
  datos: Record<string, unknown>
): { campo: string; mensaje: string }[] {
  const fuera: { campo: string; mensaje: string }[] = []
  for (const l of limites) {
    const raw = datos[l.campo]
    if (raw === '' || raw === null || raw === undefined) continue
    const num = parseFloat(String(raw))
    if (isNaN(num)) continue
    if (l.min !== null && (l.minStrict ? num <= l.min : num < l.min)) {
      fuera.push({ campo: l.campo, mensaje: `${l.etiqueta}: valor ${num} fuera de rango (${l.minStrict ? 'debe ser mayor a ' : 'mín. '}${l.min})` })
    } else if (l.max !== null && (l.maxStrict ? num >= l.max : num > l.max)) {
      fuera.push({ campo: l.campo, mensaje: `${l.etiqueta}: valor ${num} fuera de rango (${l.maxStrict ? 'debe ser menor a ' : 'máx. '}${l.max})` })
    }
  }
  return fuera
}
