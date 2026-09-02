export const GRUPO_PALETTE: Record<string, { bg: string; text: string; dot: string }> = {
  blue:   { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  green:  { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  yellow: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  purple: { bg: '#EDE9FE', text: '#5B21B6', dot: '#7C3AED' },
  pink:   { bg: '#FCE7F3', text: '#9D174D', dot: '#EC4899' },
  orange: { bg: '#FFEDD5', text: '#C2410C', dot: '#F97316' },
  red:    { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
  slate:  { bg: '#F1F5F9', text: '#475569', dot: '#64748B' },
}

export function colorForKey(colorKey: string | undefined) {
  return GRUPO_PALETTE[colorKey ?? 'slate'] ?? GRUPO_PALETTE['slate']
}

export function getGrupoColor(colorKey: string | undefined) {
  return colorForKey(colorKey)
}
