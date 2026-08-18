interface Props {
  kicker?: string
  title: string
  sub?: string
  actions?: React.ReactNode
}

export function PageHeader({ kicker, title, sub, actions }: Props) {
  return (
    <>
      <style>{`
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
        .page-header-left .kicker { font-family: var(--f-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-4); margin-bottom: 6px; }
        .page-header-left .ph-title { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink); margin: 0; line-height: 1.1; }
        .page-header-left .ph-sub { font-size: 13px; color: var(--ink-3); margin-top: 5px; }
        .page-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      `}</style>
      <div className="page-header">
        <div className="page-header-left">
          {kicker && <div className="kicker">{kicker}</div>}
          <h1 className="ph-title">{title}</h1>
          {sub && <div className="ph-sub">{sub}</div>}
        </div>
        {actions && <div className="page-header-right">{actions}</div>}
      </div>
    </>
  )
}
