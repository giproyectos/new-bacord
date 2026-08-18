import { useState } from 'react'

export interface Column<T = unknown> {
  key: string
  header: string
  width?: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
}

interface Props<T = unknown> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: string
  onRowClick?: (row: T) => void
}

const PAGE = 10

export function DataTable<T = unknown>({
  columns, data, loading,
  emptyMessage = 'No se encontraron registros',
  emptyIcon = 'fa-inbox',
  onRowClick,
}: Props<T>) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return
    if (sortKey === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col.key); setSortDir('asc') }
    setPage(1)
  }

  const sorted = (sortKey && columns.find(c => c.key === sortKey)?.sortable)
    ? [...data].sort((a, b) => {
        const av = String((a as Record<string, unknown>)[sortKey!] ?? '').toLowerCase()
        const bv = String((b as Record<string, unknown>)[sortKey!] ?? '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv, 'es') : bv.localeCompare(av, 'es')
      })
    : data

  const total   = sorted.length
  const pages   = Math.max(1, Math.ceil(total / PAGE))
  const safePage = Math.min(page, pages)
  const rows    = sorted.slice((safePage - 1) * PAGE, safePage * PAGE)
  const from    = total === 0 ? 0 : (safePage - 1) * PAGE + 1
  const to      = Math.min(safePage * PAGE, total)

  const get = (row: T, key: string) => (row as Record<string, unknown>)[key]

  const pageNums: (number | '…')[] = []
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNums.push(i)
  } else {
    pageNums.push(1)
    if (safePage > 3) pageNums.push('…')
    for (let i = Math.max(2, safePage - 1); i <= Math.min(pages - 1, safePage + 1); i++) pageNums.push(i)
    if (safePage < pages - 2) pageNums.push('…')
    pageNums.push(pages)
  }

  const ariaSort = (col: Column<T>): React.AriaAttributes['aria-sort'] => {
    if (!col.sortable || sortKey !== col.key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <>
      <style>{`
        .dt-wrap { overflow-x: auto; }
        .dt { width: 100%; border-collapse: collapse; font-size: 13px; color: var(--ink-2); }

        .dt thead tr { background: #F8FAFC; border-bottom: 1.5px solid var(--hair-2); }
        .dt thead th {
          padding: 10px 13px; text-align: left;
          font-size: 11px; font-weight: 700; color: var(--ink-3);
          text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; user-select: none;
        }
        .dt thead th.dt-sortable { cursor: pointer; }
        .dt thead th.dt-sortable:hover { color: var(--navy); }
        .dt thead th.dt-sortable:focus-visible { outline: 2px solid var(--navy); outline-offset: -2px; }

        .dt tbody tr {
          border-bottom: 1px solid var(--hair);
          transition: background 80ms;
        }
        .dt tbody tr.dt-clickable { cursor: pointer; }
        .dt tbody tr:hover { background: #F8FAFC; }
        .dt tbody tr:last-child { border-bottom: none; }
        .dt tbody td { padding: 11px 13px; vertical-align: middle; }

        .dt-empty-td { padding: 56px 20px; text-align: center; }
        .dt-empty-icon { font-size: 32px; color: var(--hair-strong); display: block; margin-bottom: 12px; }
        .dt-empty-msg  { font-size: 13.5px; color: var(--ink-4); display: block; }
        .dt-empty-hint { font-size: 12px; color: var(--ink-4); margin-top: 6px; display: block; }

        .dt-sk { height: 13px; background: var(--hair); border-radius: 3px; animation: dtsk 1.2s ease-in-out infinite; }
        @keyframes dtsk { 0%,100%{opacity:.7} 50%{opacity:.3} }

        .dt-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 2px 0; font-size:12px; color:var(--ink-4); min-height:36px; }
        .dt-pgns { display:flex; gap:3px; }
        .dt-pgn {
          min-width:32px; height:32px; padding:0 7px; display:grid; place-items:center;
          border:1.5px solid var(--hair-2); border-radius:var(--r-sm); background:none;
          cursor:pointer; font-size:12.5px; font-family:var(--f-sans); color:var(--ink-3);
          transition:background 80ms, border-color 80ms;
        }
        .dt-pgn:hover:not(:disabled):not(.dt-pgn-ell) { background:var(--paper-2); border-color:var(--hair-strong); }
        .dt-pgn:focus-visible { outline:2px solid var(--navy); outline-offset:1px; }
        .dt-pgn:disabled { opacity:.35; cursor:not-allowed; }
        .dt-pgn.dt-pgn-cur { background:var(--navy); color:#fff; border-color:var(--navy); font-weight:600; }
        .dt-pgn.dt-pgn-ell  { border:none; cursor:default; padding:0 2px; }

        .dt-act { display:flex; align-items:center; gap:3px; justify-content:center; }
        .dt-ab {
          width:32px; height:32px; border:none; border-radius:8px; cursor:pointer;
          display:grid; place-items:center; font-size:13px; background:none;
          transition:background 100ms, color 100ms; flex-shrink:0;
        }
        .dt-ab:focus-visible { outline:2px solid var(--navy); outline-offset:1px; }
        .dt-ab-edit  { color:#2563EB; }
        .dt-ab-edit:hover  { background:#EFF6FF; }
        .dt-ab-del   { color:#DC2626; }
        .dt-ab-del:hover   { background:#FEF2F2; }
        .dt-ab-extra { color:var(--ink-3); }
        .dt-ab-extra:hover { background:var(--paper-2); color:var(--ink); }
      `}</style>

      <div className="dt-wrap">
        <table className="dt" role="grid">
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  style={{ textAlign: c.align ?? 'left', width: c.width }}
                  className={c.sortable ? 'dt-sortable' : ''}
                  aria-sort={c.sortable ? ariaSort(c) : undefined}
                  tabIndex={c.sortable ? 0 : undefined}
                  onClick={() => c.sortable && handleSort(c)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && c.sortable && handleSort(c)}
                >
                  {c.header}
                  {c.sortable && (
                    <i
                      className={`fa fa-${sortKey === c.key ? (sortDir === 'asc' ? 'sort-up' : 'sort-down') : 'sort'}`}
                      style={{ marginLeft: 5, fontSize: 10, opacity: sortKey === c.key ? 1 : 0.25 }}
                      aria-hidden="true"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{columns.map(c => <td key={c.key}><div className="dt-sk" /></td>)}</tr>
                ))
              : rows.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="dt-empty-td">
                      <i className={`fa ${emptyIcon} dt-empty-icon`} aria-hidden="true" />
                      <span className="dt-empty-msg">{emptyMessage}</span>
                    </div>
                  </td>
                </tr>
              )
              : rows.map((row, i) => (
                <tr
                  key={i}
                  className={onRowClick ? 'dt-clickable' : ''}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={e => (e.key === 'Enter') && onRowClick?.(row)}
                  aria-label={onRowClick ? 'Ver detalle' : undefined}
                >
                  {columns.map(c => (
                    <td key={c.key} style={{ textAlign: c.align ?? 'left' }}
                      onClick={c.key === 'acciones' ? e => e.stopPropagation() : undefined}
                    >
                      {c.render ? c.render(row) : String(get(row, c.key) ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <div className="dt-footer">
        <span aria-live="polite" aria-atomic="true">
          {!loading && total > 0 && (
            total > PAGE
              ? `Mostrando ${from}–${to} de ${total} registros`
              : `${total} registro${total !== 1 ? 's' : ''}`
          )}
        </span>
        {total > PAGE && (
          <nav aria-label="Paginación" className="dt-pgns">
            <button
              className="dt-pgn" disabled={safePage === 1}
              onClick={() => setPage(p => p - 1)}
              aria-label="Página anterior"
            >‹</button>
            {pageNums.map((n, i) =>
              n === '…'
                ? <button key={`e${i}`} className="dt-pgn dt-pgn-ell" disabled aria-hidden="true">…</button>
                : <button
                    key={n}
                    className={`dt-pgn${safePage === n ? ' dt-pgn-cur' : ''}`}
                    onClick={() => setPage(n as number)}
                    aria-label={`Página ${n}`}
                    aria-current={safePage === n ? 'page' : undefined}
                  >{n}</button>
            )}
            <button
              className="dt-pgn" disabled={safePage === pages}
              onClick={() => setPage(p => p + 1)}
              aria-label="Página siguiente"
            >›</button>
          </nav>
        )}
      </div>
    </>
  )
}
