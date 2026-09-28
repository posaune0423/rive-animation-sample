/**
 * How the fps reads to a viewer, against the 60 Hz a phone browser renders at. Plain words for
 * the report: film is 24 fps, so below 30 the effect visibly stutters.
 */
export const smoothness = (
  fps: number,
): { readonly label: string; readonly tone: 'ok' | 'warn' | 'bad' } => {
  if (fps >= 55) return { label: 'なめらか', tone: 'ok' }
  if (fps >= 40) return { label: 'ややカクつく', tone: 'warn' }
  if (fps >= 25) return { label: 'カクつく', tone: 'bad' }
  return { label: 'コマ送り', tone: 'bad' }
}
