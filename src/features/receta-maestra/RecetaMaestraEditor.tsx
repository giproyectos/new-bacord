import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { recetaMaestraApi } from '@/api/recetaMaestra'
import { materialesApi, type Material } from '@/api/materiales'
import { procesosApi, type ProcesoItem } from '@/api/procesos'
import { detallesApi, type DetalleApi } from '@/api/detalles'
import { estrategiasFirmaApi } from '@/api/estrategiasFirma'
import { usePuedeEditar } from '@/hooks/usePermisos'
import { RECETA_ESTADO_LABEL } from '@/constants/recetaMaestra'
import { FormioFrame, injectMaterialOptions, languageOfDetalle } from '@/features/batch-record/EditarBatchRecord'
import type { RecetaMaestra, EstrategiaFirma } from '@/types'

const estadoColores: Record<number, { bg: string; color: string }> = {
  1: { bg: '#D1FAE5', color: '#065F46' },
  2: { bg: '#F1F5F9', color: '#475569' },
  3: { bg: '#DBEAFE', color: '#1D4ED8' },
  4: { bg: '#FEF3C7', color: '#92400E' },
  5: { bg: '#EDE9FE', color: '#5B21B6' },
  6: { bg: '#FEE2E2', color: '#991B1B' },
}

// Estructura local — misma forma que espera el backend en /estructura, más un `id` local para React keys.
interface DetalleItem { id: number; idDetalle: number; orden: number }
interface ProcesoItemEst { id: number; idProceso: number; orden: number; detalles: DetalleItem[] }

let _nextId = -1 // ids locales negativos para pasos/detalles nuevos aún no guardados

function swap<T>(arr: T[], i: number, j: number): T[] {
  const n = [...arr]
  ;[n[i], n[j]] = [n[j], n[i]]
  return n
}

// Vista previa del batch record: cómo quedaría el lote con la estructura que hay en pantalla.
// Solo lee datos y devuelve advertencias; no guarda ni cambia nada.
interface PreviewFormulario {
  key: number; codigo: string; descripcion: string; estado: string
  jsonSchema: string; jsonOptions: string | null | undefined
  estrategia: EstrategiaFirma | null
}
interface PreviewEtapa { key: number; orden: number; proceso: string; codigoProceso: string; formularios: PreviewFormulario[] }

function armarVistaPreviaBR(
  procesos: ProcesoItemEst[],
  procesosCatalogo: ProcesoItem[],
  detallesCatalogo: DetalleApi[],
  estrategias: EstrategiaFirma[],
): { etapas: PreviewEtapa[]; advertencias: string[] } {
  const advertencias: string[] = []
  const etapas: PreviewEtapa[] = [...procesos].sort((a, b) => a.orden - b.orden).map(rp => {
    const proc = procesosCatalogo.find(p => p.id === rp.idProceso)
    if (proc && !proc.activo) advertencias.push(`La etapa ${rp.orden} (${proc.codigo}) usa un proceso inactivo.`)
    const formularios = [...rp.detalles].sort((a, b) => a.orden - b.orden).map((rd): PreviewFormulario | null => {
      const det = detallesCatalogo.find(d => d.id === rd.idDetalle)
      if (!det) {
        advertencias.push(`La etapa ${rp.orden} tiene un formulario que ya no existe en el catálogo.`)
        return null
      }
      if (det.estado !== 'Activo') advertencias.push(`El formulario ${det.codigo} está "${det.estado}", no Activo.`)
      if (!det.idEstrategiaFirma) advertencias.push(`El formulario ${det.codigo} no tiene estrategia de firma: no se pedirán firmas de cierre.`)
      return {
        key: rd.id, codigo: det.codigo, descripcion: det.descripcion, estado: det.estado,
        jsonSchema: det.jsonSchema ?? '', jsonOptions: det.jsonOptions,
        estrategia: det.idEstrategiaFirma ? estrategias.find(e => e.id === det.idEstrategiaFirma) ?? null : null,
      }
    }).filter((f): f is PreviewFormulario => f !== null)
    if (formularios.length === 0) advertencias.push(`La etapa ${rp.orden} (${proc?.descripcion ?? '—'}) no tiene formularios.`)
    return { key: rp.id, orden: rp.orden, proceso: proc?.descripcion ?? '—', codigoProceso: proc?.codigo ?? '—', formularios }
  })
  if (etapas.length === 0) advertencias.unshift('La receta no tiene etapas: un batch record no tendría nada que llenar.')
  return { etapas, advertencias }
}

export function RecetaMaestraEditor() {
  const puedeEditar = usePuedeEditar('recetas-maestras')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = Number(id)

  const [receta, setReceta] = useState<RecetaMaestra | null>(null)
  const [loading, setLoading] = useState(true)
  const [procesos, setProcesos] = useState<ProcesoItemEst[]>([])
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  const [material, setMaterial] = useState<Material | null>(null)
  const [procesosCatalogo, setProcesosCatalogo] = useState<ProcesoItem[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [detallesCatalogo, setDetallesCatalogo] = useState<DetalleApi[]>([])
  const [estrategias, setEstrategias] = useState<EstrategiaFirma[]>([])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [modalPaso, setModalPaso] = useState(false)
  const [modalVista, setModalVista] = useState(false)
  const [modalDetalle, setModalDetalle] = useState<ProcesoItemEst | null>(null)
  const [warnPaso, setWarnPaso] = useState<ProcesoItemEst | null>(null)

  useEffect(() => {
    if (!idNum) return
    Promise.all([
      recetaMaestraApi.find(idNum),
      recetaMaestraApi.getEstructura(idNum),
      detallesApi.listar(),
      estrategiasFirmaApi.listar(),
    ]).then(async ([r, est, dets, efs]) => {
      setReceta(r)
      setDetallesCatalogo(dets)
      setEstrategias(efs)
      const mats = await materialesApi.listar()
      setMateriales(mats)
      const mat = mats.find(m => String(m.id) === r.idMateriales) ?? null
      setMaterial(mat)
      if (mat) setProcesosCatalogo(await procesosApi.listar(mat.id))

      const mapped: ProcesoItemEst[] = est.procesos.map(p => ({
        id: p.id, idProceso: p.idProceso, orden: p.orden,
        detalles: p.detalles.map(d => ({ id: d.id, idDetalle: d.idDetalle, orden: d.orden })),
      }))
      setProcesos(mapped)
      setOpenIds(new Set(mapped.map(p => p.id)))
    }).finally(() => setLoading(false))
  }, [idNum])

  const procesosDisponibles = procesosCatalogo.filter(p => p.activo && !procesos.some(ep => ep.idProceso === p.id))

  const toggleOpen = (pid: number) =>
    setOpenIds(s => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n })

  // ── Procesos ──────────────────────────────────────────────────────────────
  const agregarPaso = (idProceso: number) => {
    const maxOrden = Math.max(0, ...procesos.map(p => p.orden))
    const nuevo: ProcesoItemEst = { id: _nextId--, idProceso, orden: maxOrden + 1, detalles: [] }
    setProcesos(ps => [...ps, nuevo].sort((a, b) => a.orden - b.orden))
    setOpenIds(s => new Set(s).add(nuevo.id))
    setModalPaso(false)
  }

  const eliminarPaso = (rp: ProcesoItemEst) => {
    setProcesos(ps => ps.filter(p => p.id !== rp.id))
    setWarnPaso(null)
  }

  const moverPaso = (idx: number, dir: -1 | 1) => {
    setProcesos(ps => {
      const sorted = [...ps].sort((a, b) => a.orden - b.orden)
      const swapped = swap(sorted, idx, idx + dir)
      return swapped.map((p, i) => ({ ...p, orden: i + 1 }))
    })
  }

  // ── Detalles ──────────────────────────────────────────────────────────────
  const agregarDetalle = (rp: ProcesoItemEst, idDetalle: number) => {
    const maxOrden = Math.max(0, ...rp.detalles.map(d => d.orden))
    const nuevo: DetalleItem = { id: _nextId--, idDetalle, orden: maxOrden + 1 }
    setProcesos(ps => ps.map(p => p.id === rp.id ? { ...p, detalles: [...p.detalles, nuevo] } : p))
    setModalDetalle(null)
  }

  const eliminarDetalle = (rpId: number, rdId: number) => {
    setProcesos(ps => ps.map(p => p.id === rpId ? { ...p, detalles: p.detalles.filter(d => d.id !== rdId) } : p))
  }

  const moverDetalle = (rpId: number, idx: number, dir: -1 | 1) => {
    setProcesos(ps => ps.map(p => {
      if (p.id !== rpId) return p
      const sorted = [...p.detalles].sort((a, b) => a.orden - b.orden)
      const swapped = swap(sorted, idx, idx + dir)
      return { ...p, detalles: swapped.map((d, i) => ({ ...d, orden: i + 1 })) }
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const guardar = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const payload = procesos.map(p => ({
        idProceso: p.idProceso, orden: p.orden,
        detalles: p.detalles.map(d => ({ idDetalle: d.idDetalle, orden: d.orden })),
      }))
      const res = await recetaMaestraApi.guardarEstructura(idNum, payload)
      if (res.estado) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        // Re-fetch para reemplazar ids locales negativos por los ids reales asignados por el backend.
        const est = await recetaMaestraApi.getEstructura(idNum)
        const mapped: ProcesoItemEst[] = est.procesos.map(p => ({
          id: p.id, idProceso: p.idProceso, orden: p.orden,
          detalles: p.detalles.map(d => ({ id: d.id, idDetalle: d.idDetalle, orden: d.orden })),
        }))
        setProcesos(mapped)
        setOpenIds(new Set(mapped.map(p => p.id)))
      } else {
        setSaveError(res.mensaje)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la estructura')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <i className="fa fa-spinner fa-spin" style={{ fontSize: 20, color: 'var(--ink-4)' }} />
    </div>
  )

  if (!receta) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}>
      Receta no encontrada.
      <button className="btn btn-gray" style={{ marginLeft: 12 }} onClick={() => navigate('/recetas-maestras')}>Volver</button>
    </div>
  )

  const sortedProcesos = [...procesos].sort((a, b) => a.orden - b.orden)
  const vista = armarVistaPreviaBR(procesos, procesosCatalogo, detallesCatalogo, estrategias)
  const estado = {
    text: RECETA_ESTADO_LABEL[receta.idEstado] ?? RECETA_ESTADO_LABEL[1],
    ...(estadoColores[receta.idEstado] ?? estadoColores[1]),
  }

  return (
    <>
      <style>{`
        .rme-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
        .rme-back { background:none; border:none; cursor:pointer; color:var(--ink-4); font-size:13px; font-family:var(--f-sans); display:flex; align-items:center; gap:5px; padding:5px 8px; border-radius:var(--r-sm); transition:background 80ms; }
        .rme-back:hover { background:var(--paper-2); color:var(--ink); }
        .rme-title { font-size:17px; font-weight:700; color:var(--ink); }
        .rme-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
        .rme-save { margin-left:auto; }

        .rme-info { background:#fff; border-radius:var(--r-md); border:1.5px solid var(--hair-2); padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; gap:14px; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
        .rme-info-icon { width:42px; height:42px; border-radius:11px; background:#EEF2FF; display:grid; place-items:center; flex-shrink:0; }
        .rme-info-icon i { color:#4F46E5; font-size:18px; }
        .rme-info-name { font-size:15px; font-weight:700; color:var(--ink); }
        .rme-info-sub  { font-size:12.5px; color:var(--ink-4); margin-top:2px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .rme-info-pill { font-family:var(--f-mono); font-size:11px; font-weight:700; color:#4F46E5; background:#EEF2FF; padding:2px 8px; border-radius:4px; }

        .rme-section { background:#fff; border-radius:var(--r-md); border:1.5px solid var(--hair-2); box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden; }
        .rme-section-hdr { display:flex; align-items:center; gap:10px; padding:13px 18px; background:#FAFBFC; border-bottom:1.5px solid var(--hair-2); }
        .rme-section-title { font-size:13.5px; font-weight:700; color:var(--ink); }
        .rme-section-desc  { font-size:12px; color:var(--ink-4); margin-top:1px; }

        .rme-paso { border-bottom:1.5px solid var(--hair-2); }
        .rme-paso:last-child { border-bottom:none; }
        .rme-paso-hdr {
          display:flex; align-items:center; gap:10px; padding:12px 18px;
          cursor:pointer; transition:background 80ms; user-select:none;
        }
        .rme-paso-hdr:hover { background:#F8FAFC; }
        .rme-caret { width:20px; height:20px; display:grid; place-items:center; color:var(--ink-4); font-size:11px; transition:transform 180ms; flex-shrink:0; }
        .rme-caret.open { transform:rotate(90deg); }
        .rme-paso-num { width:26px; height:26px; border-radius:50%; background:var(--navy); color:#fff; font-size:11.5px; font-weight:700; display:grid; place-items:center; flex-shrink:0; }
        .rme-paso-name { font-size:13.5px; font-weight:600; color:var(--ink); flex:1; min-width:0; }
        .rme-paso-code { font-family:var(--f-mono); font-size:10.5px; font-weight:700; color:var(--ink-4); background:var(--paper-2); border:1px solid var(--hair-2); padding:2px 7px; border-radius:4px; flex-shrink:0; }
        .rme-det-count { font-size:11px; color:var(--ink-4); flex-shrink:0; }
        .rme-iab { width:28px; height:28px; border:none; border-radius:7px; cursor:pointer; display:grid; place-items:center; font-size:11px; background:none; transition:background 100ms, color 100ms; color:var(--ink-4); flex-shrink:0; }
        .rme-iab:hover { background:var(--paper-2); color:var(--ink); }
        .rme-iab:disabled { opacity:.2; cursor:not-allowed; }
        .rme-iab.del:hover { background:#FEF2F2; color:#DC2626; }

        .rme-det-panel { background:#F8FAFC; border-top:1px solid var(--hair-2); padding:12px 24px 14px 52px; }
        .rme-det-row { display:flex; align-items:center; gap:10px; padding:8px 12px; background:#fff; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); margin-bottom:8px; transition:box-shadow 100ms; }
        .rme-det-row:hover { box-shadow:var(--sh-1); }
        .rme-det-row:last-of-type { margin-bottom:10px; }
        .rme-det-ico { width:30px; height:30px; border-radius:8px; background:#EEF2FF; display:grid; place-items:center; flex-shrink:0; }
        .rme-det-ico i { color:#4F46E5; font-size:12px; }
        .rme-det-code { font-family:var(--f-mono); font-size:10.5px; font-weight:700; color:var(--ink-4); background:var(--paper-2); border:1px solid var(--hair-2); padding:2px 7px; border-radius:4px; flex-shrink:0; }
        .rme-det-name { font-size:13px; font-weight:500; color:var(--ink-2); flex:1; min-width:0; }
        .rme-ef-chip { font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:20px; background:#EDE9FE; color:#5B21B6; flex-shrink:0; }

        .rvp-backdrop { position:fixed; inset:0; z-index:200; background:rgba(10,21,48,.55); display:flex; align-items:center; justify-content:center; padding:24px; }
        .rvp-modal { background:#fff; border-radius:var(--r-md); width:min(980px,100%); max-height:90vh; display:flex; flex-direction:column; box-shadow:var(--sh-3); overflow:hidden; }
        .rvp-modal-hdr { display:flex; align-items:flex-start; gap:12px; padding:16px 20px; border-bottom:1.5px solid var(--hair-2); background:#FAFBFC; }
        .rvp-modal-title { font-size:15px; font-weight:700; color:var(--ink); }
        .rvp-modal-sub { font-size:12px; color:var(--ink-4); margin-top:3px; }
        .rvp-close { margin-left:auto; background:none; border:none; font-size:24px; line-height:1; color:var(--ink-4); cursor:pointer; padding:0 4px; }
        .rvp-close:hover { color:var(--ink); }
        .rvp-modal-body { overflow-y:auto; flex:1; min-height:0; padding-bottom:18px; }

        .rvp-alert { background:#FFFBEB; border:1px solid #FCD34D; border-radius:var(--r-sm); padding:12px 16px; margin:14px 18px 0; color:#92400E; font-size:12.5px; }
        .rvp-alert-title { font-weight:700; margin-bottom:6px; display:flex; align-items:center; gap:6px; }
        .rvp-alert ul { margin:0; padding-left:20px; display:flex; flex-direction:column; gap:3px; }
        .rvp-ok { margin:14px 18px 0; color:#065F46; font-size:12.5px; font-weight:600; display:flex; align-items:center; gap:6px; }
        .rvp-vacio { font-size:12.5px; color:var(--ink-4); font-style:italic; padding:6px 0; }

        .rvp-etapa { padding:18px; border-bottom:1.5px solid var(--hair-2); }
        .rvp-etapa:last-child { border-bottom:none; }
        .rvp-etapa-hdr { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .rvp-etapa-name { font-size:14px; font-weight:700; color:var(--ink); flex:1; min-width:0; }

        .rvp-form { border:1.5px solid var(--hair-2); border-radius:var(--r-sm); background:#fff; overflow:hidden; margin-bottom:14px; }
        .rvp-form:last-child { margin-bottom:0; }
        .rvp-form-hdr { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 14px; background:#FAFBFC; border-bottom:1.5px solid var(--hair-2); }
        .rvp-form-title { font-size:13px; font-weight:600; color:var(--ink); flex:1; min-width:120px; }
        .rvp-pill { font-size:10.5px; font-weight:700; padding:2px 9px; border-radius:20px; flex-shrink:0; }
        .rvp-pill-ok { background:#D1FAE5; color:#065F46; }
        .rvp-pill-warn { background:#FEF3C7; color:#92400E; }
        .rvp-pill-none { background:#F1F5F9; color:#475569; }
        .rvp-form-body { padding:16px 18px; background:#fff; }
        .rvp-form-foot { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 14px; background:#FAFBFC; border-top:1.5px solid var(--hair-2); }
        .rvp-foot-label { font-size:11px; font-weight:700; color:var(--ink-4); text-transform:uppercase; letter-spacing:.06em; margin-right:4px; }
        .rvp-firma { display:inline-flex; align-items:center; gap:7px; background:#EDE9FE; color:#5B21B6; border-radius:20px; padding:3px 11px 3px 4px; font-size:11.5px; font-weight:600; }
        .rvp-firma-n { width:18px; height:18px; border-radius:50%; background:#5B21B6; color:#fff; font-size:10px; font-weight:700; display:grid; place-items:center; }
        .rme-add-det-btn { display:flex; align-items:center; gap:6px; background:none; border:1.5px dashed var(--hair-2); border-radius:var(--r-sm); padding:6px 12px; font-size:12.5px; font-family:var(--f-sans); color:var(--ink-4); cursor:pointer; transition:border-color 120ms, color 120ms; }
        .rme-add-det-btn:hover { border-color:var(--navy); color:var(--navy); }

        .rme-empty-pasos { padding:40px 20px; text-align:center; }
        .rme-empty-pasos i { font-size:28px; color:var(--hair-2); display:block; margin-bottom:10px; }
        .rme-empty-pasos p { font-size:13px; color:var(--ink-4); margin:0 0 14px; }

        .rme-add-paso-btn { display:flex; align-items:center; gap:7px; background:none; border:none; font-size:13px; font-family:var(--f-sans); color:var(--navy); font-weight:600; cursor:pointer; padding:12px 18px; width:100%; border-top:1px solid var(--hair-2); transition:background 80ms; }
        .rme-add-paso-btn:hover { background:#F0F4FF; }

        .rme-toast { position:fixed; bottom:24px; right:24px; background:#065F46; color:#fff; padding:10px 18px; border-radius:var(--r-md); font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:var(--sh-3); z-index:300; animation:rme-fadein 200ms; }
        @keyframes rme-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

        .rme-mo { position:fixed; inset:0; z-index:200; background:rgba(10,21,48,.45); display:flex; align-items:center; justify-content:center; padding:20px; }
        .rme-mbox { background:var(--paper); border-radius:var(--r-xl); box-shadow:var(--sh-3); width:100%; max-width:500px; max-height:85vh; display:flex; flex-direction:column; }
        .rme-mhdr { background:var(--navy); border-radius:var(--r-xl) var(--r-xl) 0 0; padding:14px 22px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .rme-mhdr-ico { width:34px; height:34px; border-radius:9px; background:rgba(255,255,255,.12); display:grid; place-items:center; flex-shrink:0; }
        .rme-mhdr-ico i { color:rgba(255,220,60,.9); font-size:14px; }
        .rme-mhdr-title { color:#fff; font-weight:700; font-size:14px; }
        .rme-mhdr-sub   { color:#8FA5C9; font-size:11px; margin-top:1px; }
        .rme-mhdr-close { margin-left:auto; background:rgba(255,255,255,.1); border:none; cursor:pointer; color:#fff; width:28px; height:28px; border-radius:7px; font-size:16px; display:grid; place-items:center; }
        .rme-mhdr-close:hover { background:rgba(255,255,255,.2); }
        .rme-mlist { flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:6px; }
        .rme-mlist::-webkit-scrollbar { width:4px; }
        .rme-mlist::-webkit-scrollbar-thumb { background:var(--hair-2); border-radius:2px; }
        .rme-mitem { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:var(--r-sm); border:1.5px solid var(--hair-2); cursor:pointer; background:#fff; transition:border-color 120ms, background 80ms; }
        .rme-mitem:hover { border-color:var(--navy); background:#F0F4FF; }
        .rme-mitem-code { font-family:var(--f-mono); font-size:11px; font-weight:700; color:#4F46E5; background:#EEF2FF; padding:2px 7px; border-radius:4px; flex-shrink:0; }
        .rme-mitem-name { font-size:13px; color:var(--ink-2); flex:1; }
        .rme-mitem-ef   { font-size:11px; padding:2px 7px; background:#EDE9FE; color:#5B21B6; border-radius:20px; flex-shrink:0; }
        .rme-mfoot { padding:14px 22px; border-top:1px solid var(--hair); display:flex; justify-content:flex-end; flex-shrink:0; }
        .rme-empty-modal { padding:32px 20px; text-align:center; color:var(--ink-4); font-size:13px; }
      `}</style>

      {/* ── Header ── */}
      <div className="rme-header">
        <button className="rme-back" onClick={() => navigate('/recetas-maestras')}>
          <i className="fa fa-arrow-left" /> Recetas Maestras
        </button>
        <i className="fa fa-chevron-right" style={{ color: 'var(--hair-2)', fontSize: 11 }} />
        <span className="rme-title">{receta.codigo} · {receta.descripcion}</span>
        <span className="rme-badge" style={{ background: estado.bg, color: estado.color }}>{estado.text}</span>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, color: 'var(--ink-4)', background: 'var(--paper-2)', border: '1px solid var(--hair-2)', padding: '2px 8px', borderRadius: 4 }}>{receta.version}</span>
        {puedeEditar && (
          <button className="btn btn-primary rme-save" onClick={guardar} disabled={saving}>
            {saving ? <><i className="fa fa-spinner fa-spin" /> Guardando...</> : <><i className="fa fa-save" /> Guardar cambios</>}
          </button>
        )}
      </div>

      {saveError && (
        <div style={{ margin: '0 0 16px', padding: '10px 14px', background: '#FEF2F2', border: '1.5px solid #FECACA',
          borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 7 }}>
          <i className="fa fa-exclamation-circle" /> {saveError}
        </div>
      )}

      {/* ── Info card ── */}
      <div className="rme-info">
        <div className="rme-info-icon"><i className="fa fa-pills" /></div>
        <div style={{ flex: 1 }}>
          <div className="rme-info-name">{receta.descripcion}</div>
          <div className="rme-info-sub">
            <span><i className="fa fa-building" style={{ marginRight: 5 }} />{receta.centro}</span>
            {material
              ? <><span className="rme-info-pill">{material.codigo}</span><span>{material.descripcion}</span></>
              : <span style={{ color: 'var(--orange)', fontWeight: 600 }}>Sin material asignado</span>}
          </div>
        </div>
      </div>

      {/* ── Accordion de procesos ── */}
      <div className="rme-section">
        <div className="rme-section-hdr">
          <div>
            <div className="rme-section-title">Procesos y Formularios</div>
            <div className="rme-section-desc">
              Define los pasos de manufactura y los formularios de registro para cada paso
            </div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-4)' }}>
            {sortedProcesos.length} paso{sortedProcesos.length !== 1 ? 's' : ''} ·{' '}
            {sortedProcesos.reduce((s, p) => s + p.detalles.length, 0)} formulario{sortedProcesos.reduce((s, p) => s + p.detalles.length, 0) !== 1 ? 's' : ''}
          </span>
          <button className="btn btn-gray" style={{ flexShrink: 0 }} onClick={() => setModalVista(true)}>
            <i className="fa fa-eye" /> Vista previa del batch record
          </button>
        </div>

        {sortedProcesos.length === 0 ? (
          <div className="rme-empty-pasos">
            <i className="fa fa-sitemap" />
            <p>{procesosCatalogo.length > 0 ? 'No hay pasos definidos. Agrega el primer paso de proceso.' : `Primero crea procesos para "${material?.descripcion ?? 'este producto'}" en el catálogo de Procesos.`}</p>
            {puedeEditar && procesosCatalogo.length > 0 && (
              <button className="btn btn-primary" onClick={() => setModalPaso(true)}>
                <i className="fa fa-plus" /> Agregar primer paso
              </button>
            )}
          </div>
        ) : (
          <>
            {sortedProcesos.map((rp, idx) => {
              const proceso = procesosCatalogo.find(p => p.id === rp.idProceso)
              const isOpen = openIds.has(rp.id)
              const sortedDets = [...rp.detalles].sort((a, b) => a.orden - b.orden)
              return (
                <div key={rp.id} className="rme-paso">
                  <div className="rme-paso-hdr" onClick={() => toggleOpen(rp.id)}>
                    <span className={`rme-caret${isOpen ? ' open' : ''}`}><i className="fa fa-caret-right" /></span>
                    <span className="rme-paso-num">{rp.orden}</span>
                    <span className="rme-paso-name">{proceso?.descripcion ?? '—'}</span>
                    <span className="rme-paso-code">{proceso?.codigo ?? '—'}</span>
                    <span className="rme-det-count">
                      {rp.detalles.length > 0 ? `${rp.detalles.length} form.` : 'Sin formularios'}
                    </span>
                    {puedeEditar && (
                      <>
                        <button className="rme-iab" title="Subir" disabled={idx === 0} onClick={e => { e.stopPropagation(); moverPaso(idx, -1) }}><i className="fa fa-chevron-up" /></button>
                        <button className="rme-iab" title="Bajar" disabled={idx === sortedProcesos.length - 1} onClick={e => { e.stopPropagation(); moverPaso(idx, 1) }}><i className="fa fa-chevron-down" /></button>
                        <button className="rme-iab del" title="Eliminar paso" onClick={e => { e.stopPropagation(); setWarnPaso(rp) }}><i className="fa fa-times" /></button>
                      </>
                    )}
                  </div>

                  {isOpen && (
                    <div className="rme-det-panel">
                      {sortedDets.length === 0 && (
                        <p style={{ fontSize: 12.5, color: 'var(--ink-4)', margin: '0 0 10px' }}>
                          No hay formularios asignados a este paso.
                        </p>
                      )}
                      {sortedDets.map((rd, di) => {
                        const det = detallesCatalogo.find(d => d.id === rd.idDetalle)
                        const ef = det?.idEstrategiaFirma ? estrategias.find(e => e.id === det.idEstrategiaFirma) : null
                        return (
                          <div key={rd.id} className="rme-det-row">
                            <div className="rme-det-ico"><i className="fa fa-wpforms" /></div>
                            <span className="rme-det-code">{det?.codigo ?? '—'}</span>
                            <span className="rme-det-name">{det?.descripcion ?? '—'}</span>
                            {ef && <span className="rme-ef-chip">{ef.codigo}</span>}
                            {puedeEditar && (
                              <>
                                <button className="rme-iab" title="Subir" disabled={di === 0} onClick={() => moverDetalle(rp.id, di, -1)}><i className="fa fa-chevron-up" /></button>
                                <button className="rme-iab" title="Bajar" disabled={di === sortedDets.length - 1} onClick={() => moverDetalle(rp.id, di, 1)}><i className="fa fa-chevron-down" /></button>
                                <button className="rme-iab del" title="Quitar formulario" onClick={() => eliminarDetalle(rp.id, rd.id)}><i className="fa fa-times" /></button>
                              </>
                            )}
                          </div>
                        )
                      })}
                      {puedeEditar && (
                        <button className="rme-add-det-btn" onClick={() => setModalDetalle(rp)}>
                          <i className="fa fa-plus" /> Agregar formulario a este paso
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {puedeEditar && procesosCatalogo.length > 0 && (
          <button className="rme-add-paso-btn" onClick={() => setModalPaso(true)}>
            <i className="fa fa-plus-circle" /> Agregar paso de proceso
          </button>
        )}
      </div>

      {/* ── Vista previa del batch record (ventana emergente) ── */}
      {modalVista && (
        <div className="rvp-backdrop" onClick={() => setModalVista(false)}>
          <div className="rvp-modal" onClick={e => e.stopPropagation()}>
            <div className="rvp-modal-hdr">
              <div>
                <div className="rvp-modal-title">Vista previa del batch record</div>
                <div className="rvp-modal-sub">
                  Así verá el operario este lote. Refleja lo que hay en pantalla, incluidos los cambios sin guardar. No guarda datos.
                </div>
              </div>
              <button className="rvp-close" title="Cerrar" onClick={() => setModalVista(false)}>×</button>
            </div>
            <div className="rvp-modal-body">

        {vista.advertencias.length > 0 ? (
          <div className="rvp-alert">
            <div className="rvp-alert-title"><i className="fa fa-exclamation-triangle" /> Revisar antes de activar</div>
            <ul>
              {vista.advertencias.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        ) : vista.etapas.length > 0 ? (
          <div className="rvp-ok"><i className="fa fa-check-circle" /> Sin advertencias.</div>
        ) : null}

        {vista.etapas.map(e => (
          <div key={e.key} className="rvp-etapa">
            <div className="rvp-etapa-hdr">
              <span className="rme-paso-num">{e.orden}</span>
              <span className="rvp-etapa-name">{e.proceso}</span>
              <span className="rme-paso-code">{e.codigoProceso}</span>
            </div>

            {e.formularios.length === 0 ? (
              <div className="rvp-vacio">Esta etapa no tiene formularios.</div>
            ) : e.formularios.map(f => (
              <div key={f.key} className="rvp-form">
                <div className="rvp-form-hdr">
                  <span className="rme-det-code">{f.codigo}</span>
                  <span className="rvp-form-title">{f.descripcion}</span>
                  <span className={`rvp-pill ${f.estado === 'Activo' ? 'rvp-pill-ok' : 'rvp-pill-warn'}`}>{f.estado}</span>
                  {f.estrategia
                    ? <span className="rme-ef-chip">{f.estrategia.codigo}</span>
                    : <span className="rvp-pill rvp-pill-none">Sin estrategia</span>}
                </div>

                <div className="rvp-form-body">
                  <FormioFrame
                    schema={injectMaterialOptions(f.jsonSchema, materiales)}
                    language={languageOfDetalle(f.jsonOptions)}
                  />
                </div>

                <div className="rvp-form-foot">
                  {f.estrategia && f.estrategia.firmas.length > 0 ? (
                    <>
                      <span className="rvp-foot-label">Firmas de cierre</span>
                      {[...f.estrategia.firmas].sort((a, b) => a.orden - b.orden).map((x, i) => (
                        <span key={i} className="rvp-firma">
                          <span className="rvp-firma-n">{i + 1}</span>
                          {x.texto} · {x.grupo}
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="rvp-foot-label">No se pedirán firmas de cierre</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Agregar paso ── */}
      {modalPaso && (
        <div className="rme-mo" onClick={() => setModalPaso(false)}>
          <div className="rme-mbox" onClick={e => e.stopPropagation()}>
            <div className="rme-mhdr">
              <div className="rme-mhdr-ico"><i className="fa fa-sitemap" /></div>
              <div>
                <div className="rme-mhdr-title">Agregar paso de proceso</div>
                <div className="rme-mhdr-sub">
                  Procesos disponibles para {material?.descripcion ?? '—'}
                </div>
              </div>
              <button className="rme-mhdr-close" onClick={() => setModalPaso(false)}>×</button>
            </div>
            <div className="rme-mlist">
              {procesosDisponibles.length === 0 ? (
                <div className="rme-empty-modal">
                  <i className="fa fa-check-circle" style={{ fontSize: 24, color: '#10B981', display: 'block', marginBottom: 8 }} />
                  Todos los pasos del catálogo ya están en esta receta.
                </div>
              ) : (
                procesosDisponibles.map(p => (
                  <div key={p.id} className="rme-mitem" onClick={() => agregarPaso(p.id)}>
                    <span className="rme-mitem-code">{p.codigo}</span>
                    <span className="rme-mitem-name">{p.descripcion}</span>
                    <i className="fa fa-plus" style={{ color: 'var(--ink-4)', fontSize: 12 }} />
                  </div>
                ))
              )}
            </div>
            <div className="rme-mfoot">
              <button className="btn btn-gray" onClick={() => setModalPaso(false)}><i className="fa fa-times" /> Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Agregar formulario ── */}
      {modalDetalle && (() => {
        const yaAsignados = new Set(modalDetalle.detalles.map(d => d.idDetalle))
        const disponibles = detallesCatalogo.filter(d => !yaAsignados.has(d.id) && d.estado === 'Activo')
        return (
          <div className="rme-mo" onClick={() => setModalDetalle(null)}>
            <div className="rme-mbox" onClick={e => e.stopPropagation()}>
              <div className="rme-mhdr">
                <div className="rme-mhdr-ico"><i className="fa fa-wpforms" /></div>
                <div>
                  <div className="rme-mhdr-title">Agregar formulario</div>
                  <div className="rme-mhdr-sub">
                    Paso: {procesosCatalogo.find(p => p.id === modalDetalle.idProceso)?.descripcion}
                  </div>
                </div>
                <button className="rme-mhdr-close" onClick={() => setModalDetalle(null)}>×</button>
              </div>
              <div className="rme-mlist">
                {disponibles.length === 0 ? (
                  <div className="rme-empty-modal">Todos los formularios ya están asignados a este paso, o no hay formularios en el catálogo de Detalles.</div>
                ) : (
                  disponibles.map(d => {
                    const ef = d.idEstrategiaFirma ? estrategias.find(e => e.id === d.idEstrategiaFirma) : null
                    return (
                      <div key={d.id} className="rme-mitem" onClick={() => agregarDetalle(modalDetalle, d.id)}>
                        <span className="rme-mitem-code">{d.codigo}</span>
                        <span className="rme-mitem-name">{d.descripcion}</span>
                        {ef && <span className="rme-mitem-ef">{ef.codigo}</span>}
                        <i className="fa fa-plus" style={{ color: 'var(--ink-4)', fontSize: 12 }} />
                      </div>
                    )
                  })
                )}
              </div>
              <div className="rme-mfoot">
                <button className="btn btn-gray" onClick={() => setModalDetalle(null)}><i className="fa fa-times" /> Cerrar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal: Confirmar eliminar paso ── */}
      {warnPaso && (
        <div className="rme-mo" onClick={() => setWarnPaso(null)}>
          <div style={{ background: 'var(--paper)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-3)', width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '22px 22px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <i className="fa fa-exclamation-triangle" style={{ color: '#DC2626', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>¿Quitar este paso?</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Se quitará <strong>{procesosCatalogo.find(p => p.id === warnPaso.idProceso)?.descripcion}</strong> y sus {warnPaso.detalles.length} formulario{warnPaso.detalles.length !== 1 ? 's' : ''} asignado{warnPaso.detalles.length !== 1 ? 's' : ''}.
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--hair)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-gray" onClick={() => setWarnPaso(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-danger" onClick={() => eliminarPaso(warnPaso)}><i className="fa fa-times" /> Quitar paso</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast de guardado ── */}
      {saved && (
        <div className="rme-toast">
          <i className="fa fa-check-circle" /> Cambios guardados correctamente
        </div>
      )}
    </>
  )
}
