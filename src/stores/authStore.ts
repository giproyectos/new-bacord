import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@/types'
interface AuthState {
  user: AuthUser | null; isAuthenticated: boolean
  login: (u: AuthUser) => void; logout: () => void
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'bacord-auth' }
  )
)
