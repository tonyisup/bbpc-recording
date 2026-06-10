'use client';

import { useCallback, useRef, useState } from 'react';
import { useSession } from './SessionProvider';
import { useAudio } from './AudioProvider';
import { useRecordingEngine } from '@/hooks/useRecordingEngine';
import { useRecordingSync } from '@/hooks/useRecordingSync';

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function VUMeter({ level }: { level: number }) {
  const bars = 8;
  const activeBars = Math.round(level * bars);
  return (
    <div className="flex items-end gap-0.5 h-4">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-sm transition-all ${
            i < activeBars
              ? i >= bars - 2
                ? 'bg-[var(--danger)]'
                : i >= bars - 4
                ? 'bg-[var(--warning)]'
                : 'bg-[var(--success)]'
              : 'bg-[var(--card-border)]'
          }`}
          style={{ height: `${((i + 1) * 100) / bars}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardHeader() {
  const { state, elapsedMs, dispatch } = useSession();
  const { stopAll } = useAudio();
  const recording = useRecordingEngine();
  const uploadStatusRef = useRef<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  // Pusher recording sync
  const recordingStartRef = useRef<number>(0);

  const handleRemoteStart = useCallback((startedAt: number) => {
    console.log('[Recording] Remote host started recording at', startedAt);
    // Could auto-start local recording here if desired
  }, []);

  const handleRemoteStop = useCallback((startedAt: number, durationMs: number) => {
    console.log('[Recording] Remote host stopped recording', { startedAt, durationMs });
  }, []);

  const { broadcastStart, broadcastStop } = useRecordingSync({
    channelName: state.episode.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    hostName: state.hostName,
    onRemoteStart: handleRemoteStart,
    onRemoteStop: handleRemoteStop,
  });

  const uploadTrack = useCallback(async (
    episode: string,
    hostName: string,
    trackType: 'mic' | 'sounders',
    blob: Blob,
    startedAt: number,
  ) => {
    try {
      // Convert blob to base64 (browser-compatible)
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const res = await fetch('/api/recordings/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode, hostName, trackType, startedAt, audioBase64: base64 }),
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return true;
    } catch (err) {
      console.error('[Recording] Upload error:', err);
      return false;
    }
  }, []);

  const handleToggleRecording = async () => {
    if (recording.state.isRecording) {
      // Stop recording
      const tracks = await recording.stopRecording();
      recordingStartRef.current = 0;

      // Broadcast stop to other hosts
      broadcastStop(tracks.startedAt, tracks.durationMs);

      // Upload both tracks
      setUploadStatus('uploading');
      uploadStatusRef.current = 'uploading';

      const [micOk, sounderOk] = await Promise.all([
        uploadTrack(state.episode, state.hostName, 'mic', tracks.mic, tracks.startedAt),
        uploadTrack(state.episode, state.hostName, 'sounders', tracks.sounders, tracks.startedAt),
      ]);

      const finalStatus = micOk && sounderOk ? 'done' : 'error';
      setUploadStatus(finalStatus);
      uploadStatusRef.current = finalStatus;

      // Reset status after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        uploadStatusRef.current = 'idle';
      }, 3000);
    } else {
      // Start recording
      const hasPermission = await recording.requestMicPermission();
      if (!hasPermission) return;

      await recording.startRecording();
      recordingStartRef.current = Date.now();

      // Broadcast start to other hosts
      broadcastStart(recordingStartRef.current);
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight">{state.episode}</h1>
        <span className="text-xs text-[var(--muted)]">{state.date}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* WebRTC Audio Recording */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--card-border)]">
          {recording.state.error ? (
            <span className="text-xs text-[var(--danger)]" title={recording.state.error}>
              ⚠ Mic error
            </span>
          ) : recording.state.isRecording ? (
            <>
              <VUMeter level={recording.state.micLevel} />
              <span className="text-xs text-[var(--danger)] font-medium animate-pulse">REC</span>
              <span className="text-xs text-[var(--muted)] font-mono">
                {formatElapsed(recording.state.durationMs)}
              </span>
              {uploadStatus === 'uploading' && (
                <span className="text-xs text-[var(--warning)] animate-pulse">↑ uploading...</span>
              )}
              {uploadStatus === 'done' && (
                <span className="text-xs text-[var(--success)]">✓ uploaded</span>
              )}
              {uploadStatus === 'error' && (
                <span className="text-xs text-[var(--danger)]">✗ upload failed</span>
              )}
            </>
          ) : (
            <button
              onClick={handleToggleRecording}
              disabled={uploadStatus === 'uploading'}
              className="px-2 py-1 text-xs font-medium rounded border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
              title="Start recording mic + sounders to separate tracks"
            >
              ⏺ Record Audio
            </button>
          )}

          {recording.state.isRecording && (
            <button
              onClick={handleToggleRecording}
              className="px-2 py-1 text-xs font-medium rounded border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        {/* Sounder stop */}
        <button
          onClick={stopAll}
          className="px-2 py-1.5 text-xs font-medium rounded border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
          title="Stop all playing sounders"
        >
          ⏹
        </button>

        {/* Host name */}
        <span className="text-sm text-[var(--muted)]">{state.hostName}</span>

        {/* Session timer */}
        <div className={`font-mono text-xl font-bold tabular-nums ${state.isRecording ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>
          {state.isRecording ? formatElapsed(elapsedMs) : '--:--:--'}
        </div>

        {/* Session recording */}
        {state.isRecording ? (
          <button
            onClick={() => dispatch({ type: 'STOP_RECORDING' })}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--danger)] text-white hover:opacity-90 transition-opacity"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => dispatch({ type: 'START_RECORDING' })}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--success)] text-white hover:opacity-90 transition-opacity"
          >
            Start Recording
          </button>
        )}
      </div>
    </header>
  );
}
