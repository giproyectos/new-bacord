import { create } from 'zustand'
import type { AuditEntry } from '@/types/audit'

interface AuditState {
  entries: AuditEntry[]
  add: (entry: AuditEntry) => void
  clear: () => void
}

export const useAuditStore = create<AuditState>()((set) => ({
  entries: [],
  add: (entry) => set(s => ({ entries: [entry, ...s.entries].slice(0, 2000) })),
  clear: () => set({ entries: [] }),
}))
