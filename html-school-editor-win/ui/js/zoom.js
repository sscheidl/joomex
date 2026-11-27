// Zoom steps of the code pane and the page pane (wish W2 of the owner's collection, 2026-11-27). Each pane has
// its own level; Ctrl+wheel and Ctrl+plus or Ctrl+minus step it, Ctrl+0 resets it. The level is remembered by
// the core in HKCU. Zoom changes only the look, never the code.

export const ZOOM_STEPS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];
export const ZOOM_DEFAULT = 100;

// The nearest step to `percent` (a level remembered by an older version, or set by the engine's own zoom of the
// native page view, can lie between two steps).
export function nearestZoom(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p)) return ZOOM_DEFAULT;
  return ZOOM_STEPS.reduce((best, s) => (Math.abs(s - p) < Math.abs(best - p) ? s : best), ZOOM_DEFAULT);
}

// One step up (dir 1) or down (dir -1) from `percent`; dir 0 is the default.
export function nextZoom(percent, dir) {
  if (!dir) return ZOOM_DEFAULT;
  const i = ZOOM_STEPS.indexOf(nearestZoom(percent));
  return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))];
}
