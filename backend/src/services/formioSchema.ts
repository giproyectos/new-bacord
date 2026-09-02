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
