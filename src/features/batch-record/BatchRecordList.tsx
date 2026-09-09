import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { batchRecordApi } from '@/api/batchRecord'
import { ordenProcesoApi } from '@/api/ordenProceso'
import { usuariosApi } from '@/api/usuarios'
import { desviacionesApi } from '@/api/desviaciones'
import { auditoriaApi } from '@/api/auditoria'
import { DataTable, type Column } from '@/components/shared/DataTable'
import type { BatchRecord } from '@/types'
import { useAudit } from '@/hooks/useAudit'
import { useAuthStore } from '@/stores/authStore'
import { usePuedeEditar } from '@/hooks/usePermisos'

const estadoCfg: Record<number, { label: string; bg: string; color: string; dot: string }> = {
  1: { label: 'En Tratamiento', bg: '#DBEAFE', color: '#1D4ED8', dot: '#3B82F6' },
  2: { label: 'Finalizado',     bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  3: { label: 'Cancelado',      bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
  4: { label: 'Liberado',       bg: '#EDE9FE', color: '#5B21B6', dot: '#7C3AED' },
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function progressColor(pct: number) {
  if (pct === 100) return { grad: 'linear-gradient(90deg,#059669,#34D399)', text: '#059669' }
  if (pct >= 60)   return { grad: 'linear-gradient(90deg,#2563EB,#60A5FA)', text: '#2563EB' }
  if (pct >= 25)   return { grad: 'linear-gradient(90deg,#D97706,#FCD34D)', text: '#D97706' }
  return { grad: 'linear-gradient(90deg,#DC2626,#F87171)', text: '#DC2626' }
}

export function BatchRecordList() {
  const puedeEditar  = usePuedeEditar('batch-records')
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const { registrar } = useAudit()
  const authUser     = useAuthStore(s => s.user)
  const [selected, setSelected]         = useState<Set<number>>(new Set())
  const [search, setSearch]             = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [fechaDesde, setFechaDesde]     = useState('')
  const [fechaHasta, setFechaHasta]     = useState('')
  const [usuarioFilter, setUsuarioFilter] = useState('')
  const [confirmCancel, setConfirmCancel] = useState<BatchRecord | null>(null)
  const [cancelLogin, setCancelLogin]     = useState('')
  const [cancelPin, setCancelPin]         = useState('')
  const [cancelShowPin, setCancelShowPin] = useState(false)
  const [cancelMotivo, setCancelMotivo]   = useState('')
  const [cancelError, setCancelError]     = useState('')
  const [cancelSaving, setCancelSaving]   = useState(false)

  const cerrarModalCancelar = () => {
    setConfirmCancel(null); setCancelLogin(''); setCancelPin(''); setCancelMotivo(''); setCancelError('')
  }

  const { data = [], isLoading } = useQuery({
    queryKey: ['batch-records'],
    queryFn: () => batchRecordApi.buscar(),
  })
  const { data: ordenes = [] } = useQuery({
    queryKey: ['ordenes-proceso'],
    queryFn: () => ordenProcesoApi.buscar(),
  })
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosApi.listar(),
  })

  const filtered = data.filter(r => {
    const orden = ordenes.find(o => o.idOrdenProceso === r.idOrdenProceso)
    const text = `${r.idBatchRecord} ${r.idFormulaControl} ${orden?.codigoMaterial ?? ''} ${orden?.descripcionMaterial ?? ''} ${r.fechaCreacion}`.toLowerCase()
    const matchText    = !search || text.includes(search.toLowerCase())
    const matchEstado  = !estadoFilter || r.idEstado === Number(estadoFilter)
    const brDate       = r.fechaCreacion ? new Date(r.fechaCreacion) : null
    const matchDesde   = !fechaDesde || (brDate != null && brDate >= new Date(fechaDesde))
    const matchHasta   = !fechaHasta || (brDate != null && brDate <= new Date(fechaHasta + 'T23:59:59'))
    const matchUsuario = !usuarioFilter || r.idUsuarioCreacion === Number(usuarioFilter)
    return matchText && matchEstado && matchDesde && matchHasta && matchUsuario
  })

  const hasFilters = !!(search || estadoFilter || fechaDesde || fechaHasta || usuarioFilter)
  const clearFilters = () => { setSearch(''); setEstadoFilter(''); setFechaDesde(''); setFechaHasta(''); setUsuarioFilter('') }

  const toggleSelect    = (id: number, e: React.MouseEvent) => { e.stopPropagation(); setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  const toggleSelectAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(r => r.idBatchRecord)))
  const allSelected     = filtered.length > 0 && selected.size === filtered.length
  const someSelected    = selected.size > 0 && !allSelected

  // ── Generador de paquete de auditoría multi-lote ──────────────────────────
  const [packageBusy, setPackageBusy] = useState(false)
  const generateMultiAuditPackage = async () => {
    const selectedBRs = data.filter(r => selected.has(r.idBatchRecord))
    if (selectedBRs.length === 0) return

    setPackageBusy(true)
    let allDesviaciones: Awaited<ReturnType<typeof desviacionesApi.listar>> = []
    let firmasMap = new Map<number, Awaited<ReturnType<typeof batchRecordApi.getFirmas>>>()
    let auditMap = new Map<number, Awaited<ReturnType<typeof auditoriaApi.consultar>>>()
    let detalleLabelMap = new Map<number, string>()
    try {
      const [desv, firmasPorBR, auditPorBR, estructuraPorBR] = await Promise.all([
        desviacionesApi.listar(),
        Promise.all(selectedBRs.map(br => batchRecordApi.getFirmas(br.idBatchRecord))),
        Promise.all(selectedBRs.map(br => auditoriaApi.consultar({ idEntidad: br.idBatchRecord }))),
        Promise.all(selectedBRs.map(br => batchRecordApi.getEstructura(br.idBatchRecord))),
      ])
      allDesviaciones = desv
      firmasMap = new Map(selectedBRs.map((br, i) => [br.idBatchRecord, firmasPorBR[i]]))
      auditMap = new Map(selectedBRs.map((br, i) => [br.idBatchRecord, auditPorBR[i].filter(e => e.entidad !== 'Sesion')]))
      for (const estructura of estructuraPorBR) {
        for (const proceso of estructura) {
          for (const item of proceso.detalles) {
            detalleLabelMap.set(item.detalle.id, item.detalle.descripcion)
          }
        }
      }
    } catch {
      setPackageBusy(false)
      alert('No fue posible reunir la información del paquete de auditoría. Intente de nuevo.')
      return
    }
    setPackageBusy(false)

    const now     = new Date()
    const nowFmt  = now.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    const pkgNum  = `PKG-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
    const genUser = authUser ? `${authUser.nombres ?? ''} ${authUser.apellidos ?? ''}`.trim() || authUser.login : 'Sistema'
    const genCargo = authUser?.grupos?.split(',')[0]?.trim() ?? 'Usuario'

    const AUDIT_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
      CREAR:          { label:'Creación',      bg:'#D1FAE5', color:'#065F46', border:'#6EE7B7' },
      MODIFICAR:      { label:'Modificación',  bg:'#DBEAFE', color:'#1D4ED8', border:'#93C5FD' },
      CANCELAR:       { label:'Cancelación',   bg:'#FEE2E2', color:'#991B1B', border:'#FCA5A5' },
      FIRMAR_SECCION: { label:'Firma Sección', bg:'#EDE9FE', color:'#5B21B6', border:'#C4B5FD' },
      FIRMAR_CIERRE:  { label:'Firma Cierre',  bg:'#EDE9FE', color:'#5B21B6', border:'#C4B5FD' },
      DEROGAR_FIRMA:  { label:'Derogación',    bg:'#FEF3C7', color:'#92400E', border:'#FDE68A' },
      LIBERAR_LOTE:   { label:'Liberación',    bg:'#D1FAE5', color:'#065F46', border:'#6EE7B7' },
    }
    const ESTADO_LABEL: Record<number, string> = { 1:'En Tratamiento', 2:'Finalizado', 3:'Cancelado', 4:'Liberado' }
    const ESTADO_COLOR: Record<number, string> = { 1:'#1D4ED8', 2:'#065F46', 3:'#991B1B', 4:'#5B21B6' }
    const ESTADO_BG:    Record<number, string> = { 1:'#DBEAFE', 2:'#D1FAE5', 3:'#FEE2E2', 4:'#EDE9FE' }

    const totalDesv   = allDesviaciones.filter(d => selected.has(d.idBatchRecord))
    const openDesv    = totalDesv.filter(d => d.estado === 'abierta')
    const relevantAudit = [...auditMap.values()].flat().sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const css = `
      @page { margin: 20mm 18mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; margin: 0; line-height: 1.5; }
      h1 { font-size: 22px; font-weight: 800; color: #0A2D63; margin: 0 0 6px; }
      h2 { font-size: 15px; font-weight: 800; color: #0A2D63; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #0A2D63; page-break-after: avoid; }
      h3 { font-size: 12.5px; font-weight: 700; color: #374151; margin: 14px 0 8px; }
      .pg-break { page-break-before: always; }
      .pg-header { background: linear-gradient(135deg,#0A2D63 0%,#1D4ED8 100%); color: #fff; padding: 28px 32px; border-radius: 0 0 16px 16px; margin-bottom: 28px; }
      .pg-header-sub { font-size: 11px; color: rgba(255,255,255,.7); margin-top: 4px; letter-spacing:.04em; }
      .pg-footer { margin-top: 28px; padding-top: 12px; border-top: 1.5px solid #E5E7EB; display: flex; justify-content: space-between; font-size: 10px; color: #9CA3AF; }
      .meta-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 22px; }
      .meta-box { background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; }
      .meta-box-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing:.06em; margin-bottom: 4px; }
      .meta-box-value { font-size: 14px; font-weight: 800; color: #111827; }
      .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 22px; }
      .kpi { border-radius: 10px; padding: 14px 16px; border: 1.5px solid; }
      .kpi-n { font-size: 26px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
      .kpi-l { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing:.06em; }
      .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1px solid; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
      th { background: #F1F5F9; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing:.05em; border-bottom: 2px solid #E2E8F0; white-space: nowrap; }
      td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
      tr:nth-child(even) td { background: #FAFAFA; }
      .sec { margin-bottom: 24px; }
      .sec-title { font-size: 12px; font-weight: 700; color: #0A2D63; padding: 8px 14px; background: #EFF6FF; border-left: 4px solid #1D4ED8; border-radius: 0 8px 8px 0; margin-bottom: 10px; }
      .br-section-header { background: linear-gradient(135deg,#1E3A5F 0%,#0A2D63 100%); color: #fff; padding: 18px 22px; border-radius: 10px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
      .br-section-id { font-size: 20px; font-weight: 900; letter-spacing:.02em; }
      .br-section-sub { font-size: 11px; color: rgba(255,255,255,.7); margin-top: 3px; }
      .desv-abierta { background:#FEF3C7; border:1.5px solid #FDE68A; border-radius:8px; padding:10px 14px; margin-bottom:8px; }
      .desv-cerrada { background:#F0FDF4; border:1.5px solid #BBF7D0; border-radius:8px; padding:10px 14px; margin-bottom:8px; }
      .val-ant { background:#FEE2E2; color:#991B1B; padding:0 5px; border-radius:3px; font-family:monospace; font-size:10px; }
      .val-nv  { background:#D1FAE5; color:#065F46; padding:0 5px; border-radius:3px; font-family:monospace; font-size:10px; }
      .gen-box { background:#F0FDF4; border:1.5px solid #6EE7B7; border-radius:10px; padding:16px 20px; margin-top:24px; }
    `

    // ── Portada ────────────────────────────────────────────────────────────
    const productosPortada = Array.from(new Set(
      selectedBRs.map(br => ordenes.find(x => x.idOrdenProceso === br.idOrdenProceso)?.descripcionMaterial).filter(Boolean)
    )).join(' · ') || 'Múltiples productos'
    const coverBRList = selectedBRs.map(br => {
      const o   = ordenes.find(x => x.idOrdenProceso === br.idOrdenProceso)
      const est = ESTADO_LABEL[br.idEstado] ?? '—'
      const bg  = ESTADO_BG[br.idEstado] ?? '#F1F5F9'
      const col = ESTADO_COLOR[br.idEstado] ?? '#374151'
      return `<tr>
        <td><strong>BR-${br.idBatchRecord}</strong></td>
        <td>${o?.descripcionMaterial ?? '—'}</td>
        <td style="font-family:monospace">${o?.loteLogistico ?? '—'}</td>
        <td style="font-family:monospace">${o?.numeroOrdenProceso ?? '—'}</td>
        <td><span class="badge" style="background:${bg};color:${col};border-color:${col}20">${est}</span></td>
        <td style="text-align:right">${br.porcentajeAvance ?? 0}%</td>
      </tr>`
    }).join('')

    // ── Resumen ejecutivo ──────────────────────────────────────────────────
    const byEstado = (id: number) => selectedBRs.filter(r => r.idEstado === id).length
    const avgAvance = selectedBRs.length > 0
      ? Math.round(selectedBRs.reduce((s, r) => s + (r.porcentajeAvance ?? 0), 0) / selectedBRs.length)
      : 0

    const alertasHTML = openDesv.length === 0
      ? '<p style="color:#059669;font-weight:600">✓ Sin desviaciones abiertas en los lotes seleccionados.</p>'
      : openDesv.map(d => `
          <div class="desv-abierta">
            <strong>BR-${d.idBatchRecord} · ${d.campo}</strong> — ${d.labelCampo}<br/>
            <span style="color:#92400E;font-size:11px">Valor ingresado: <strong>${d.valorIngresado}</strong> · ${d.descripcion}</span>
          </div>`).join('')

    // ── Tabla comparativa ──────────────────────────────────────────────────
    const compRows = selectedBRs.map(br => {
      const o    = ordenes.find(x => x.idOrdenProceso === br.idOrdenProceso)
      const desv = allDesviaciones.filter(d => d.idBatchRecord === br.idBatchRecord)
      const brAudit = auditMap.get(br.idBatchRecord) ?? []
      const numFirmas = (firmasMap.get(br.idBatchRecord) ?? []).length
      const col = ESTADO_COLOR[br.idEstado] ?? '#374151'
      const bg  = ESTADO_BG[br.idEstado] ?? '#F1F5F9'
      return `<tr>
        <td><strong style="font-family:monospace">BR-${br.idBatchRecord}</strong></td>
        <td>${o?.descripcionMaterial ?? '—'}<br/><span style="color:#94A3B8;font-size:10px;font-family:monospace">${o?.codigoMaterial ?? ''}</span></td>
        <td style="font-family:monospace">${o?.loteLogistico ?? '—'}</td>
        <td style="text-align:right">${o?.cantidadOrden?.toLocaleString('es-CO') ?? '—'} ${o?.unidadMedida ?? ''}</td>
        <td><span class="badge" style="background:${bg};color:${col};border-color:${col}20">${ESTADO_LABEL[br.idEstado] ?? '—'}</span></td>
        <td style="text-align:right"><strong>${br.porcentajeAvance ?? 0}%</strong></td>
        <td style="text-align:center">${desv.filter(d=>d.estado==='abierta').length > 0 ? `<span style="color:#D97706;font-weight:700">${desv.filter(d=>d.estado==='abierta').length} abierta(s)</span>` : `<span style="color:#059669">${desv.length === 0 ? '—' : desv.length+' cerrada(s)'}</span>`}</td>
        <td style="text-align:center">${numFirmas}</td>
        <td style="text-align:center">${brAudit.length}</td>
      </tr>`
    }).join('')

    // ── Secciones por BR ───────────────────────────────────────────────────
    const brSections = selectedBRs.map((br, bi) => {
      const o       = ordenes.find(x => x.idOrdenProceso === br.idOrdenProceso)
      const desv    = allDesviaciones.filter(d => d.idBatchRecord === br.idBatchRecord)
      const firmados = firmasMap.get(br.idBatchRecord) ?? []
      const brAudit = [...(auditMap.get(br.idBatchRecord) ?? [])]
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Firmas
      const firmaRows = firmados.map(f => {
        const secLabel = detalleLabelMap.get(f.idDetalle) ?? f.firma.descripcion
        return `<tr>
          <td style="font-family:monospace;font-size:10px">${f.firma.codigo}</td>
          <td>${secLabel}</td>
          <td><strong>${f.usuario.nombres} ${f.usuario.apellidos}</strong><br/><span style="color:#94A3B8;font-family:monospace;font-size:10px">${f.usuario.login}</span></td>
          <td>${f.firma.grupo.nombre}</td>
          <td style="font-family:monospace;font-size:10px">${new Date(f.firmadoEn).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
        </tr>`
      }).join('')

      // Desviaciones
      const dsvHTML = desv.length === 0
        ? '<p style="color:#059669;font-size:11px">✓ Sin desviaciones registradas para este BR.</p>'
        : desv.map(d => `
            <div class="${d.estado === 'abierta' ? 'desv-abierta' : 'desv-cerrada'}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <strong>${d.campo} · ${d.labelCampo}</strong>
                <span class="badge" style="background:${d.estado==='abierta'?'#FEF3C7':'#D1FAE5'};color:${d.estado==='abierta'?'#92400E':'#065F46'};border-color:${d.estado==='abierta'?'#FDE68A':'#6EE7B7'}">
                  ${d.estado.toUpperCase()}
                </span>
              </div>
              <div style="font-size:11px;color:#374151">${d.descripcion}</div>
              <div style="font-size:10px;color:#94A3B8;margin-top:4px">
                Valor: <strong>${d.valorIngresado}</strong> · ${d.limiteInfo} · ${d.usuarioReporta.nombres} ${d.usuarioReporta.apellidos} · ${d.fechaHora}
              </div>
            </div>`).join('')

      // Audit trail
      const auditRows = brAudit.length === 0
        ? '<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:20px">Sin eventos de auditoría registrados.</td></tr>'
        : brAudit.map(e => {
            const cfg  = AUDIT_CFG[e.accion] ?? { label:e.accion, bg:'#F1F5F9', color:'#475569', border:'#CBD5E1' }
            const d    = new Date(e.timestamp)
            const fec  = d.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'})
            const hor  = d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
            const sec  = e.descripcionEntidad
            const det  = e.cambios && e.cambios.length > 0
              ? e.cambios.map(c => `<span style="font-size:10px">${c.etiqueta}: <span class="val-ant">${c.valorAnterior||'—'}</span> → <span class="val-nv">${c.valorNuevo||'—'}</span></span>`).join('<br/>')
              : (e.motivo ? `<em style="color:#92400E">${e.motivo}</em>` : '—')
            return `<tr>
              <td style="font-family:monospace;font-size:10px;white-space:nowrap">${hor}<br/>${fec}</td>
              <td><span class="badge" style="background:${cfg.bg};color:${cfg.color};border-color:${cfg.border}">${cfg.label}</span></td>
              <td style="font-size:10.5px">${sec}</td>
              <td><strong style="font-size:11px">${e.nombreUsuario}</strong><br/><span style="font-family:monospace;font-size:9.5px;color:#94A3B8">${e.loginUsuario}</span></td>
              <td style="font-size:10.5px;color:#64748B">${e.cargo}</td>
              <td style="font-size:10.5px">${det}</td>
            </tr>`
          }).join('')

      const estCol = ESTADO_COLOR[br.idEstado] ?? '#374151'
      const estBg  = ESTADO_BG[br.idEstado] ?? '#F1F5F9'

      return `
        <div class="pg-break">
          <div class="br-section-header">
            <div>
              <div class="br-section-id">BR-${br.idBatchRecord}</div>
              <div class="br-section-sub">${o?.descripcionMaterial ?? '—'} · Lote ${o?.loteLogistico ?? '—'}</div>
            </div>
            <div style="text-align:right">
              <span class="badge" style="background:${estBg};color:${estCol};border-color:${estCol}20;font-size:11px;padding:4px 14px">${ESTADO_LABEL[br.idEstado] ?? '—'}</span>
              <div style="color:rgba(255,255,255,.6);font-size:10px;margin-top:5px">${br.porcentajeAvance ?? 0}% completado</div>
            </div>
          </div>

          <!-- Identificación -->
          <div class="sec">
            <div class="sec-title">4.${bi+1}.1 · Identificación del Lote</div>
            <table>
              <tr><th>Producto</th><th>Código Material</th><th>Lote No.</th><th>Orden de Proceso</th><th>Tamaño de Lote</th></tr>
              <tr>
                <td>${o?.descripcionMaterial ?? '—'}</td>
                <td style="font-family:monospace">${o?.codigoMaterial ?? '—'}</td>
                <td style="font-family:monospace">${o?.loteLogistico ?? '—'}</td>
                <td style="font-family:monospace">${o?.numeroOrdenProceso ?? '—'}</td>
                <td>${o?.cantidadOrden?.toLocaleString('es-CO') ?? '—'} ${o?.unidadMedida ?? ''}</td>
              </tr>
            </table>
            <table>
              <tr><th>Centro / Planta</th><th>Fecha Fabricación</th><th>Fecha Caducidad</th><th>Avance</th><th>Estado</th></tr>
              <tr>
                <td>${o?.centro ?? '—'}</td>
                <td>${o?.fechaFabricacion ?? '—'}</td>
                <td>${o?.fechaCaducidad ?? '—'}</td>
                <td><strong>${br.porcentajeAvance ?? 0}%</strong></td>
                <td><span class="badge" style="background:${estBg};color:${estCol};border-color:${estCol}20">${ESTADO_LABEL[br.idEstado]??'—'}</span></td>
              </tr>
            </table>
          </div>

          <!-- Firmas -->
          <div class="sec">
            <div class="sec-title">4.${bi+1}.2 · Registro de Firmas y Verificaciones</div>
            ${firmados.length === 0
              ? '<p style="color:#94A3B8;font-size:11px">Sin firmas registradas para este BR.</p>'
              : `<table>
                  <tr><th>Clave</th><th>Sección</th><th>Firmante</th><th>Cargo</th><th>Fecha / Hora</th></tr>
                  ${firmaRows}
                 </table>`}
          </div>

          <!-- Desviaciones -->
          <div class="sec">
            <div class="sec-title">4.${bi+1}.3 · Desviaciones GMP</div>
            ${dsvHTML}
          </div>

          <!-- Audit Trail -->
          <div class="sec">
            <div class="sec-title">4.${bi+1}.4 · Historial de Auditoría — Trazabilidad Completa</div>
            <table>
              <tr><th>Fecha / Hora</th><th>Acción</th><th>Sección</th><th>Usuario</th><th>Cargo</th><th>Detalle</th></tr>
              ${auditRows}
            </table>
          </div>
        </div>`
    }).join('')

    // ── Registro de generación del paquete ─────────────────────────────────
    registrar({
      entidad: 'BatchRecord',
      idEntidad: selectedBRs[0].idBatchRecord,
      descripcionEntidad: `Paquete Multi-Lote ${pkgNum}`,
      accion: 'MODIFICAR',
      modulo: 'BatchRecordList',
      cambios: selectedBRs.map(br => ({
        campo: `BR-${br.idBatchRecord}`,
        etiqueta: `Lote BR-${br.idBatchRecord}`,
        valorAnterior: '',
        valorNuevo: `Incluido en paquete ${pkgNum}`,
      })),
      motivo: `Generación de paquete de auditoría multi-lote ${pkgNum} — ${selectedBRs.length} BR(s) incluidos`,
    })

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><title>Paquete Auditoría ${pkgNum}</title>
<style>${css}</style></head>
<body>

<!-- ══ PORTADA ══ -->
<div class="pg-header">
  <div style="font-size:10px;color:rgba(255,255,255,.6);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">${productosPortada}</div>
  <h1 style="color:#fff;font-size:26px;margin:0 0 4px">Paquete de Auditoría Multi-Lote</h1>
  <div class="pg-header-sub">${pkgNum} &nbsp;·&nbsp; Documento GMP Confidencial &nbsp;·&nbsp; Generado: ${nowFmt}</div>
</div>

<div class="meta-grid">
  <div class="meta-box">
    <div class="meta-box-label">Generado por</div>
    <div class="meta-box-value" style="font-size:13px">${genUser}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:2px">${genCargo} · ${authUser?.login ?? ''}</div>
  </div>
  <div class="meta-box">
    <div class="meta-box-label">Fecha y Hora</div>
    <div class="meta-box-value" style="font-size:13px">${nowFmt}</div>
  </div>
  <div class="meta-box">
    <div class="meta-box-label">Lotes incluidos</div>
    <div class="meta-box-value">${selectedBRs.length}</div>
  </div>
</div>

<div class="sec">
  <div class="sec-title">1. Lotes incluidos en este paquete</div>
  <table>
    <tr><th>Batch Record</th><th>Producto</th><th>Lote No.</th><th>Orden</th><th>Estado</th><th>Avance</th></tr>
    ${coverBRList}
  </table>
</div>

<!-- ══ RESUMEN EJECUTIVO ══ -->
<div class="pg-break">
  <h2>2. Resumen Ejecutivo</h2>
  <div class="kpi-row">
    <div class="kpi" style="background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8">
      <div class="kpi-n">${selectedBRs.length}</div>
      <div class="kpi-l">BRs seleccionados</div>
    </div>
    <div class="kpi" style="background:#D1FAE5;border-color:#6EE7B7;color:#065F46">
      <div class="kpi-n">${byEstado(2) + byEstado(4)}</div>
      <div class="kpi-l">Finalizados / Liberados</div>
    </div>
    <div class="kpi" style="background:#FEF3C7;border-color:#FDE68A;color:#92400E">
      <div class="kpi-n">${openDesv.length}</div>
      <div class="kpi-l">Desviaciones abiertas</div>
    </div>
    <div class="kpi" style="background:#EDE9FE;border-color:#C4B5FD;color:#5B21B6">
      <div class="kpi-n">${relevantAudit.length}</div>
      <div class="kpi-l">Eventos de auditoría</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-box-label">Avance promedio</div>
      <div class="meta-box-value">${avgAvance}%</div>
    </div>
    <div class="meta-box">
      <div class="meta-box-label">En Tratamiento</div>
      <div class="meta-box-value" style="color:#1D4ED8">${byEstado(1)}</div>
    </div>
    <div class="meta-box">
      <div class="meta-box-label">Cancelados</div>
      <div class="meta-box-value" style="color:#991B1B">${byEstado(3)}</div>
    </div>
  </div>

  <h3>Alertas activas — Desviaciones abiertas</h3>
  ${alertasHTML}
</div>

<!-- ══ TABLA COMPARATIVA ══ -->
<div class="pg-break">
  <h2>3. Tabla Comparativa de Lotes</h2>
  <table>
    <tr>
      <th>BR</th><th>Producto / Código</th><th>Lote No.</th><th>Tamaño Lote</th>
      <th>Estado</th><th>Avance</th><th>Desviaciones</th><th>Firmas</th><th>Eventos Audit</th>
    </tr>
    ${compRows}
  </table>
</div>

<!-- ══ DETALLE POR BR ══ -->
<div class="pg-break">
  <h2>4. Detalle por Batch Record</h2>
</div>
${brSections}

<!-- ══ REGISTRO DE GENERACIÓN ══ -->
<div class="pg-break">
  <h2>5. Registro de Generación del Paquete</h2>
  <p style="font-size:12px;color:#374151;line-height:1.7">
    El presente paquete de auditoría fue generado electrónicamente en el sistema BACord EBR.
    Su generación queda registrada en el historial de auditoría del sistema con plena trazabilidad GMP.
  </p>
  <div class="gen-box">
    <table style="margin:0">
      <tr><th style="width:200px">Campo</th><th>Valor</th></tr>
      <tr><td>Número de paquete</td><td><strong style="font-family:monospace">${pkgNum}</strong></td></tr>
      <tr><td>Generado por</td><td>${genUser} (${authUser?.login ?? '—'}) · ${genCargo}</td></tr>
      <tr><td>Fecha y hora de generación</td><td>${nowFmt}</td></tr>
      <tr><td>BRs incluidos</td><td>${selectedBRs.map(b=>`BR-${b.idBatchRecord}`).join(', ')}</td></tr>
      <tr><td>Total eventos de auditoría</td><td>${relevantAudit.length}</td></tr>
      <tr><td>Total desviaciones</td><td>${totalDesv.length} (${openDesv.length} abierta(s))</td></tr>
      <tr><td>Sistema</td><td>BACord EBR v1.0 — Registro Electrónico de Lotes</td></tr>
      <tr><td>Clasificación</td><td><strong style="color:#991B1B">CONFIDENCIAL — Solo uso interno GMP</strong></td></tr>
    </table>
  </div>
  <div class="pg-footer">
    <span>${pkgNum} · BACord EBR v1.0</span>
    <span>Documento generado electrónicamente — ${nowFmt}</span>
    <span>CONFIDENCIAL</span>
  </div>
</div>

</body></html>`

    const win = window.open('', '_blank', 'width=1100,height=850')
    if (!win) { alert('Habilita ventanas emergentes para generar el paquete'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  // Summary counts from full dataset
  const counts = {
    tratamiento: data.filter(r => r.idEstado === 1).length,
    finalizado:  data.filter(r => r.idEstado === 2).length,
    cancelado:   data.filter(r => r.idEstado === 3).length,
    liberado:    data.filter(r => r.idEstado === 4).length,
  }

  const columns: Column<BatchRecord>[] = [
    {
      key: '_sel', header: '', width: '42px', align: 'center',
      render: r => (
        <input
          type="checkbox"
          checked={selected.has(r.idBatchRecord)}
          onChange={() => {}}
          onClick={e => toggleSelect(r.idBatchRecord, e)}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0A2D63' }}
          aria-label={`Seleccionar BR-${r.idBatchRecord}`}
        />
      ),
    },
    {
      key: 'idBatchRecord', header: 'Batch Record', width: '110px', sortable: true,
      render: r => (
        <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: 'var(--navy)', fontSize: 13 }}>
          BR-{r.idBatchRecord}
        </span>
      ),
    },
    {
      key: 'idOrdenProceso', header: 'Orden', width: '110px',
      render: r => {
        const o = ordenes.find(x => x.idOrdenProceso === r.idOrdenProceso)
        return (
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
            {o?.numeroOrdenProceso ?? `OP-${r.idOrdenProceso}`}
          </span>
        )
      },
    },
    {
      key: 'material', header: 'Material / Producto',
      render: r => {
        const o = ordenes.find(x => x.idOrdenProceso === r.idOrdenProceso)
        return o ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', lineHeight: 1.35 }}>
              {o.descripcionMaterial}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
              {o.codigoMaterial} · Lote {o.loteLogistico}
            </div>
          </div>
        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>
      },
    },
    {
      key: 'idEstado', header: 'Estado', width: '130px',
      render: r => {
        const cfg = estadoCfg[r.idEstado] ?? estadoCfg[1]
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
            background: cfg.bg, color: cfg.color,
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} aria-hidden="true" />
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'porcentajeAvance', header: 'Avance', width: '140px',
      render: r => {
        const pct = r.porcentajeAvance ?? 0
        const { grad, text } = progressColor(pct)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{ flex: 1, height: 8, background: '#E8EDF5', borderRadius: 4, overflow: 'hidden' }}
              role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
              aria-label={`Avance: ${pct}%`}
            >
              <div style={{ height: '100%', width: `${pct}%`, background: grad, borderRadius: 4, transition: 'width 400ms' }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--f-mono)', color: text, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>
              {pct}%
            </span>
          </div>
        )
      },
    },
    {
      key: 'fechaCreacion', header: 'Creación', width: '110px', sortable: true,
      render: r => (
        <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
          {fmtDate(r.fechaCreacion)}
        </span>
      ),
    },
    {
      key: 'acciones', header: '', width: '104px', align: 'center',
      render: r => (
        <div className="dt-act" onClick={e => e.stopPropagation()}>
          {r.idEstado === 1 && (
            <button
              className="dt-ab dt-ab-edit"
              title="Editar registro"
              aria-label={`Editar BR-${r.idBatchRecord}`}
              onClick={() => navigate(`/batch-records/${r.idBatchRecord}/editar`)}
            >
              <i className="fa fa-pencil-alt" aria-hidden="true" />
            </button>
          )}
          <button
            className="dt-ab dt-ab-extra"
            title="Ver detalle"
            aria-label={`Ver detalle de BR-${r.idBatchRecord}`}
            onClick={() => navigate(`/batch-records/${r.idBatchRecord}/consultar`)}
          >
            <i className="fa fa-eye" aria-hidden="true" />
          </button>
          {r.idEstado === 1 && puedeEditar && (
            <button
              className="dt-ab dt-ab-del"
              title="Cancelar batch record"
              aria-label={`Cancelar BR-${r.idBatchRecord}`}
              onClick={() => { setConfirmCancel(r); setCancelLogin(authUser?.login ?? '') }}
            >
              <i className="fa fa-ban" aria-hidden="true" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <style>{`
        /* ── Summary strip ── */
        .br-summary {
          display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
        }
        .br-stat {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 14px; border-radius: 10px; border: 1px solid;
          cursor: pointer; transition: opacity .15s;
          text-decoration: none;
        }
        .br-stat:hover { opacity: .8; }
        .br-stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .br-stat-n { font-size: 17px; font-weight: 800; line-height: 1; }
        .br-stat-l { font-size: 11px; font-weight: 500; margin-top: 1px; }

        /* ── Filter bar ── */
        .br-filters {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; margin-bottom: 14px; flex-wrap: wrap;
          background: #fff; border: 1.5px solid var(--hair-2);
          border-radius: var(--r-md);
        }
        .br-search-wrap { position: relative; flex: 1; min-width: 220px; }
        .br-search-wrap .ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--ink-4); font-size: 12px; pointer-events: none; }
        .br-search {
          width: 100%; padding: 0 12px 0 32px; height: 36px;
          border: 1.5px solid var(--hair-2); border-radius: var(--r-sm);
          font-size: 13px; font-family: var(--f-sans); outline: none;
          background: var(--paper); color: var(--ink);
          transition: border-color 120ms;
        }
        .br-search:focus { border-color: var(--navy); background: #fff; }
        .br-select {
          height: 36px; padding: 0 28px 0 12px; min-width: 155px;
          border: 1.5px solid var(--hair-2); border-radius: var(--r-sm);
          font-size: 13px; font-family: var(--f-sans); outline: none;
          background: var(--paper); color: var(--ink);
          cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8F9F' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
          transition: border-color 120ms;
        }
        .br-select:focus { border-color: var(--navy); background-color: #fff; }
        .br-count { margin-left: auto; font-size: 12.5px; color: var(--ink-4); white-space: nowrap; flex-shrink: 0; }
        .br-filters-sep { width: 100%; height: 1px; background: var(--hair-2); margin: 4px 0; }
        .br-filters-lbl { font-size: 11px; font-weight: 700; color: var(--ink-4); white-space: nowrap; text-transform: uppercase; letter-spacing: .04em; }
        .br-date {
          height: 36px; padding: 0 10px; min-width: 130px;
          border: 1.5px solid var(--hair-2); border-radius: var(--r-sm);
          font-size: 12.5px; font-family: var(--f-sans); outline: none;
          background: var(--paper); color: var(--ink); cursor: pointer;
          transition: border-color 120ms;
        }
        .br-date:focus { border-color: var(--navy); background: #fff; }
        .br-date-sep { font-size: 12px; color: var(--ink-4); flex-shrink: 0; }
        .br-count b { color: var(--ink-2); }

        /* ── Table card ── */
        .br-card {
          background: #fff; border: 1.5px solid var(--hair-2);
          border-radius: var(--r-md); overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }
        .br-card-head {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px;
          background: #FAFBFC; border-bottom: 1.5px solid var(--hair-2);
          border-left: 3px solid var(--navy);
        }
        .br-card-title { font-size: 13.5px; font-weight: 700; color: var(--ink); flex: 1; }
        .br-card-body  { padding: 0; }

        /* ── Barra flotante multi-selección ── */
        .br-float-bar {
          position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
          z-index: 300; display: flex; align-items: center; gap: 12px;
          background: #0A2D63; color: #fff; border-radius: 14px;
          padding: 12px 20px; box-shadow: 0 8px 32px rgba(10,45,99,.45);
          animation: floatIn .2s ease;
        }
        @keyframes floatIn { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        .br-float-count { font-size: 13px; font-weight: 700; white-space: nowrap; }
        .br-float-count span { font-size: 20px; font-weight: 900; margin-right: 4px; }
        .br-float-clear { background: rgba(255,255,255,.12); border: none; color: rgba(255,255,255,.7); border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: var(--f-sans); }
        .br-float-clear:hover { background: rgba(255,255,255,.2); color: #fff; }
        .br-float-btn { background: #F7C92E; color: #0A2D63; border: none; border-radius: 10px; padding: 9px 18px; font-size: 12.5px; font-weight: 800; cursor: pointer; font-family: var(--f-sans); display: flex; align-items: center; gap: 7px; white-space: nowrap; }
        .br-float-btn:hover { background: #FDE68A; }

        /* ── Backdrop ── */
        @media (prefers-reduced-motion: reduce) {
          .br-stat, .br-search, .br-select { transition: none !important; }
        }
      `}</style>

      {/* ── Summary strip ── */}
      {!isLoading && (
        <div className="br-summary" role="region" aria-label="Resumen de estados">
          {([
            { id: 1, label: 'En Tratamiento', n: counts.tratamiento, bg: '#DBEAFE', color: '#1D4ED8', dot: '#3B82F6', border: '#BFDBFE' },
            { id: 2, label: 'Finalizados',    n: counts.finalizado,  bg: '#D1FAE5', color: '#065F46', dot: '#10B981', border: '#A7F3D0' },
            { id: 4, label: 'Liberados',      n: counts.liberado,    bg: '#EDE9FE', color: '#5B21B6', dot: '#7C3AED', border: '#DDD6FE' },
            { id: 3, label: 'Cancelados',     n: counts.cancelado,   bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444', border: '#FECACA' },
          ] as const).map(s => (
            <button
              key={s.id}
              className="br-stat"
              style={{ background: s.bg, borderColor: s.border, color: s.color }}
              onClick={() => setEstadoFilter(estadoFilter === String(s.id) ? '' : String(s.id))}
              aria-pressed={estadoFilter === String(s.id)}
              aria-label={`Filtrar por ${s.label}: ${s.n} registros`}
            >
              <div className="br-stat-dot" style={{ background: s.dot }} aria-hidden="true" />
              <div>
                <div className="br-stat-n">{s.n}</div>
                <div className="br-stat-l">{s.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="br-filters" role="search" aria-label="Filtros de búsqueda">
        <div className="br-search-wrap">
          <i className="fa fa-search ico" aria-hidden="true" />
          <input
            className="br-search"
            type="search"
            placeholder="Buscar por BR, orden, material…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar batch records"
          />
        </div>
        <select
          className="br-select"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="1">En Tratamiento</option>
          <option value="2">Finalizado</option>
          <option value="3">Cancelado</option>
          <option value="4">Liberado</option>
        </select>
        {hasFilters && (
          <button
            className="btn btn-gray"
            style={{ height: 36, padding: '0 12px', flexShrink: 0 }}
            onClick={clearFilters}
            aria-label="Limpiar filtros"
          >
            <i className="fa fa-times" aria-hidden="true" /> Limpiar
          </button>
        )}
        <span className="br-count" aria-live="polite">
          <b>{filtered.length}</b> de {data.length} registros
        </span>

        {/* ── Segunda fila: fecha + operario ── */}
        <div className="br-filters-sep" />
        <span className="br-filters-lbl">Fecha creación:</span>
        <input
          type="date"
          className="br-date"
          value={fechaDesde}
          onChange={e => setFechaDesde(e.target.value)}
          aria-label="Fecha desde"
          title="Desde"
        />
        <span className="br-date-sep">—</span>
        <input
          type="date"
          className="br-date"
          value={fechaHasta}
          onChange={e => setFechaHasta(e.target.value)}
          aria-label="Fecha hasta"
          title="Hasta"
        />
        <select
          className="br-select"
          style={{ minWidth: 180 }}
          value={usuarioFilter}
          onChange={e => setUsuarioFilter(e.target.value)}
          aria-label="Filtrar por operario"
        >
          <option value="">Todos los operarios</option>
          {usuarios.map(u => (
            <option key={u.idUsuario} value={u.idUsuario}>
              {u.nombres} {u.apellidos}
            </option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="br-card">
        <div className="br-card-head">
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected }}
            onChange={toggleSelectAll}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0A2D63', flexShrink: 0 }}
            aria-label="Seleccionar todos los BRs visibles"
          />
          <i className="fa fa-clipboard-list" style={{ color: 'var(--navy)', fontSize: 14 }} aria-hidden="true" />
          <span className="br-card-title">Batch Records</span>
          {hasFilters && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontStyle: 'italic' }}>
              Filtros activos
            </span>
          )}
        </div>
        <div className="br-card-body" style={{ padding: '0 18px 14px' }}>
          <DataTable<BatchRecord>
            columns={columns}
            data={filtered}
            loading={isLoading}
            emptyMessage={
              hasFilters
                ? 'No hay registros que coincidan con los filtros aplicados'
                : 'Aún no hay Batch Records registrados'
            }
            emptyIcon={hasFilters ? 'fa-filter' : 'fa-clipboard-list'}
            onRowClick={r => navigate(`/batch-records/${r.idBatchRecord}/editar`)}
          />
        </div>
      </div>

      {/* ── Barra flotante multi-selección ── */}
      {selected.size > 0 && (
        <div className="br-float-bar" role="toolbar" aria-label="Acciones sobre BRs seleccionados">
          <div className="br-float-count">
            <span>{selected.size}</span>
            BR{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </div>
          <button className="br-float-clear" onClick={() => setSelected(new Set())}>
            Limpiar
          </button>
          <button className="br-float-btn" onClick={generateMultiAuditPackage} disabled={packageBusy} aria-disabled={packageBusy}>
            <i className={`fa ${packageBusy ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} aria-hidden="true" />
            {packageBusy ? 'Generando…' : 'Exportar paquete de auditoría'}
          </button>
        </div>
      )}

      {/* ── Modal cancelación ── */}
      {confirmCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(10,21,48,.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
          onClick={cerrarModalCancelar}
        >
          <div
            style={{ background:'var(--paper)',borderRadius:'var(--r-xl)',boxShadow:'var(--sh-3)',width:'100%',maxWidth:440 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ background:'#7C2D12',borderRadius:'var(--r-xl) var(--r-xl) 0 0',padding:'14px 22px',display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:34,height:34,borderRadius:9,background:'rgba(255,255,255,.12)',display:'grid',placeItems:'center',flexShrink:0 }}>
                <i className="fa fa-ban" style={{ color:'#FCA5A5',fontSize:15 }} aria-hidden="true" />
              </div>
              <div id="cancel-modal-title" style={{ flex:1,color:'#fff',fontWeight:700,fontSize:14 }}>
                Cancelar Batch Record
              </div>
              <button
                style={{ background:'rgba(255,255,255,.1)',border:'none',cursor:'pointer',color:'#fff',width:30,height:30,borderRadius:8,fontSize:18,display:'grid',placeItems:'center' }}
                onClick={cerrarModalCancelar}
                aria-label="Cerrar"
              >×</button>
            </div>

            {/* Modal body */}
            <div style={{ padding:'20px 22px 6px',fontSize:14,color:'var(--ink-2)',lineHeight:1.65 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'10px 14px',background:'#FEF2F2',borderRadius:10,border:'1px solid #FECACA' }}>
                <i className="fa fa-exclamation-triangle" style={{ color:'#DC2626',fontSize:14 }} aria-hidden="true" />
                <span style={{ fontSize:13,color:'#991B1B',fontWeight:600 }}>Esta acción no se puede deshacer</span>
              </div>
              ¿Está seguro que desea cancelar <strong>BR-{confirmCancel.idBatchRecord}</strong>?
              El registro quedará bloqueado y no podrá reanudarse.
            </div>

            {/* Usuario + PIN — cancelar un lote es un evento GMP crítico, exige la misma
                re-autenticación que firmar, liberar o derogar una firma. */}
            <div style={{ padding:'0 22px 14px',display:'flex',flexDirection:'column',gap:14 }}>
              <div>
                <label htmlFor="cancel-login" style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:5 }}>
                  Usuario <span style={{ color:'#DC2626',fontWeight:400 }}>(requerido)</span>
                </label>
                <input
                  id="cancel-login" className="form-control" value={cancelLogin}
                  onChange={e => { setCancelLogin(e.target.value); setCancelError('') }}
                  placeholder="login"
                />
              </div>
              <div>
                <label htmlFor="cancel-pin" style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:5 }}>
                  PIN de firma <span style={{ color:'#DC2626',fontWeight:400 }}>(requerido)</span>
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    id="cancel-pin" type={cancelShowPin ? 'text' : 'password'} inputMode="numeric" className="form-control"
                    value={cancelPin} onChange={e => { setCancelPin(e.target.value); setCancelError('') }}
                    placeholder="••••••" style={{ paddingRight:36 }}
                  />
                  <button type="button"
                    style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-4)' }}
                    onClick={() => setCancelShowPin(s => !s)}>
                    {cancelShowPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Motivo */}
            <div style={{ padding:'0 22px 18px' }}>
              <label htmlFor="cancel-motivo" style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:6 }}>
                Motivo de cancelación <span style={{ color:'#DC2626',fontWeight:400 }}>* requerido</span>
              </label>
              <textarea
                id="cancel-motivo"
                className="form-control"
                rows={3}
                value={cancelMotivo}
                onChange={e => setCancelMotivo(e.target.value)}
                placeholder="Describa el motivo para cancelar este batch record…"
                style={{ resize:'vertical' }}
                aria-required="true"
                aria-describedby="cancel-motivo-hint"
              />
              <div id="cancel-motivo-hint" style={{ fontSize:11.5,color:'var(--ink-4)',marginTop:5 }}>
                El motivo quedará registrado en el historial de auditoría.
              </div>
              {cancelError && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fa fa-exclamation-circle" /> {cancelError}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding:'12px 22px 16px',borderTop:'1px solid var(--hair)',display:'flex',justifyContent:'flex-end',gap:8 }}>
              <button
                className="btn btn-gray"
                onClick={cerrarModalCancelar}
              >
                <i className="fa fa-undo" aria-hidden="true" /> Volver
              </button>
              <button
                className="btn btn-danger"
                disabled={!cancelLogin || !cancelPin || !cancelMotivo.trim() || cancelSaving}
                aria-disabled={!cancelLogin || !cancelPin || !cancelMotivo.trim() || cancelSaving}
                onClick={async () => {
                  if (!cancelLogin || !cancelPin || !cancelMotivo.trim()) return
                  setCancelError('')
                  setCancelSaving(true)
                  try {
                    const res = await batchRecordApi.cancelar(confirmCancel.idBatchRecord, cancelLogin.trim(), cancelPin, cancelMotivo.trim())
                    if (!res.estado) { setCancelError(res.mensaje); return }
                    queryClient.invalidateQueries({ queryKey: ['batch-records'] })
                    cerrarModalCancelar()
                  } finally {
                    setCancelSaving(false)
                  }
                }}
              >
                <i className="fa fa-ban" aria-hidden="true" /> {cancelSaving ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
