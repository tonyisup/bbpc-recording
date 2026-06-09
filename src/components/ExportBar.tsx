'use client';

import type { Manifest } from '@/types';
import { downloadManifest, downloadLabels } from '@/lib/export-labels';

interface ExportBarProps {
  manifest: Manifest;
}

export function ExportBar({ manifest }: ExportBarProps) {
  return (
    <div className="flex gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <button
        onClick={() => downloadManifest(manifest)}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
      >
        Download Manifest
      </button>
      <button
        onClick={() => downloadLabels(manifest)}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        Download Labels
      </button>
      <span className="ml-auto text-xs text-zinc-500 self-center">
        {manifest.episode} · {manifest.segments.length} segments · {manifest.edit_cues.length} edit cues · {manifest.notes.length} notes
      </span>
    </div>
  );
}
