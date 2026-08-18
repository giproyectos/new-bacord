import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { router } from './router'

// Purgar todos los datos de batch record al inicio — no hay persistencia, los BRs cargan desde mock
;(function purgeSessionData() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('br_') || k === 'bacord-audit')
      .forEach(k => localStorage.removeItem(k))
  } catch {}
})()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
