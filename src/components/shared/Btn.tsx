import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}

const variants = {
  default: 'btn-default',
  primary: 'btn-primary',
  ghost:   'btn-ghost',
  danger:  'btn-danger',
}

export function Btn({ variant = 'default', size = 'md', icon, children, className = '', ...rest }: Props) {
  return (
    <>
      <style>{`
        .btn-base {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--f-sans); font-weight: 500; border-radius: var(--r-sm);
          cursor: pointer; border: none; transition: background 120ms, box-shadow 120ms;
          white-space: nowrap;
        }
        .btn-base:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn-md { padding: 7px 14px; font-size: 13.5px; }
        .btn-sm { padding: 5px 10px; font-size: 12px; }
        .btn-md svg, .btn-sm svg { width: 14px; height: 14px; stroke-width: 1.8; }

        .btn-default {
          background: var(--white); color: var(--ink-2);
          border: 1.5px solid var(--hair-2);
          box-shadow: var(--sh-1);
        }
        .btn-default:hover:not(:disabled) { background: var(--paper-2); }

        .btn-primary {
          background: var(--navy); color: #fff;
          box-shadow: var(--sh-1);
        }
        .btn-primary:hover:not(:disabled) { background: var(--navy-700); }

        .btn-ghost { background: transparent; color: var(--ink-3); border: none; }
        .btn-ghost:hover:not(:disabled) { background: var(--paper-2); color: var(--ink); }

        .btn-danger { background: #fef2f2; color: #b91c1c; border: 1.5px solid #fecaca; }
        .btn-danger:hover:not(:disabled) { background: #fee2e2; }
      `}</style>
      <button
        className={`btn-base ${variants[variant]} btn-${size} ${className}`}
        {...rest}
      >
        {icon}
        {children}
      </button>
    </>
  )
}
