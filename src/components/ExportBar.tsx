'use client';

import { useState } from 'react';
import type { Manifest } from '@/types';
import { downloadManifest, downloadLabels } from '@/lib/export-labels';

interface ExportBarProps {
  manifest: Manifest;
}

export function ExportBar({ manifest }: ExportBarProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle');

  const handleUpload = async () => {
    setUploadStatus('uploading');
    try {
      const res = await fetch('/api/manifest/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      setUploadStatus('ok');
      setTimeout(() => setUploadStatus('idle'), 3000);
    } catch (err) {
      console.error('[Upload]', err);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  };

  return (
    <div className="flex gap-3 p-4 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
      <button
        onClick={() => downloadManifest(manifest)}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
      >
        Download Manifest
      </button>
      <button
        onClick={() => downloadLabels(manifest)}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--card-border)] hover:border-[var(--accent)] transition-colors"
      >
        Download Labels
      </button>
      <button
        onClick={handleUpload}
        disabled={uploadStatus === 'uploading'}
        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
          uploadStatus === 'ok'
            ? 'border-[var(--success)] text-[var(--success)]'
            : uploadStatus === 'error'
            ? 'border-[var(--danger)] text-[var(--danger)]'
            : 'border-[var(--card-border)] hover:border-[var(--accent)] disabled:opacity-50'
        }`}
      >
        {uploadStatus === 'uploading' ? 'Uploading...'
          : uploadStatus === 'ok' ? 'Uploaded ✓'
          : uploadStatus === 'error' ? 'Failed ✗'
          : 'Upload to Pipeline'}
      </button>
      <span className="ml-auto text-xs text-[var(--muted)] self-center">
        {manifest.episode} · {manifest.segments.length} segments · {manifest.edit_cues.length} edit cues · {manifest.notes.length} notes
      </span>
    </div>
  );
}
