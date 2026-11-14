export function fadeWindow(value: number, start: number, end: number, feather = 0.035) {
  if (value <= start || value >= end) return 0
  if (value < start + feather) return (value - start) / feather
  if (value > end - feather) return (end - value) / feather
  return 1
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const span = edge1 - edge0
  if (span === 0) return x < edge0 ? 0 : 1
  const t = Math.min(1, Math.max(0, (x - edge0) / span))
  return t * t * (3 - 2 * t)
}
