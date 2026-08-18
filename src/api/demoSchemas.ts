import et1f1 from '../../Datos Demo/DEMO_ET1_F1_Encabezado.txt?raw'
import et1f2 from '../../Datos Demo/DEMO_ET1_F2_Pesaje.txt?raw'
import et1f3 from '../../Datos Demo/DEMO_ET1_F3_Verificacion.txt?raw'
import et2f1 from '../../Datos Demo/DEMO_ET2_F1_SetupEncapsuladora.txt?raw'
import et2f2 from '../../Datos Demo/DEMO_ET2_F2_ControlProceso.txt?raw'
import et2f3 from '../../Datos Demo/DEMO_ET2_F3_RendimientoEncap.txt?raw'
import et3f1 from '../../Datos Demo/DEMO_ET3_F1_InspeccionVisual.txt?raw'
import et3f2 from '../../Datos Demo/DEMO_ET3_F2_Empaque.txt?raw'
import et3f3 from '../../Datos Demo/DEMO_ET3_F3_CierreLote.txt?raw'

// Each .txt file is a single form.io panel object.
// Wrap it as the top-level component so DetallesList can parse it.
const wrap = (raw: string) => JSON.stringify({ components: [JSON.parse(raw.replace(/^﻿/, ''))] })

export const SCHEMA_ET1_F1 = wrap(et1f1)
export const SCHEMA_ET1_F2 = wrap(et1f2)
export const SCHEMA_ET1_F3 = wrap(et1f3)
export const SCHEMA_ET2_F1 = wrap(et2f1)
export const SCHEMA_ET2_F2 = wrap(et2f2)
export const SCHEMA_ET2_F3 = wrap(et2f3)
export const SCHEMA_ET3_F1 = wrap(et3f1)
export const SCHEMA_ET3_F2 = wrap(et3f2)
export const SCHEMA_ET3_F3 = wrap(et3f3)
