import type { Manifest } from '@/types';

/**
 * Convert a session manifest to Audacity label track format.
 *
 * Audacity plain-text label format: tab-separated columns
 *   start_seconds<TAB>end_seconds<TAB>label
 * One label per line, no header row, 6 decimal places.
 *
 * Mapping:
 *   Segments   → region labels  "{label}"
 *   Edit cues  → region labels  "{type}: {reason}"
 *   Notes      → 0.5s regions  "📝 {text}"
 *   Sounders   → point labels   "🔊 {name}"
 *
 * Items with null end_ms are skipped (open-ended).
 */
export function manifestToAudacityLabels(manifest: Manifest): string {
  const lines: string[] = [];

  for (const seg of manifest.segments) {
    if (seg.end_ms === null) continue;
    lines.push(formatRegion(seg.start_ms, seg.end_ms, seg.label));
  }

  for (const cue of manifest.edit_cues) {
    if (cue.end_ms === null) continue;
    const label = cue.reason ? `${cue.type}: ${cue.reason}` : cue.type;
    lines.push(formatRegion(cue.start_ms, cue.end_ms, label));
  }

  for (const note of manifest.notes) {
    const start = note.timestamp_ms;
    const end = note.timestamp_ms + 500;
    lines.push(formatRegion(start, end, `\u{1F4DD} ${note.text}`));
  }

  for (const s of manifest.sounders_used) {
    const t = formatSeconds(s.played_at_ms);
    lines.push(`${t}\t${t}\t\u{1F50A} ${s.name}`);
  }

  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}

function formatRegion(startMs: number, endMs: number, label: string): string {
  return `${formatSeconds(startMs)}\t${formatSeconds(endMs)}\t${label}`;
}

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(6);
}

// ---------------------------------------------------------------------------
// Browser download helpers (client-side only)
// ---------------------------------------------------------------------------

export function downloadManifest(manifest: Manifest): void {
  const json = JSON.stringify(manifest, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `${manifest.episode}-session-manifest.json`);
}

export function downloadLabels(manifest: Manifest): void {
  const labels = manifestToAudacityLabels(manifest);
  const blob = new Blob([labels], { type: 'text/plain' });
  triggerDownload(blob, `${manifest.episode}-labels.txt`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
