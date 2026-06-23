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
  const { state, elapsedMs, dispatch, sessionId, inviteUrl } = useSession();
  const { stopAll } = useAudio();
  const recording = useRecordingEngine();
  const uploadStatusRef = useRef<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [micPermissionOk, setMicPermissionOk] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const hostName = state.hostName;
  const episodeName = state.episode;
  const [editingEpisode, setEditingEpisode] = useState(false);
  const [episodeInput, setEpisodeInput] = useState('');
  const episodeInputRef = useRef<HTMLInputElement>(null);

  const saveEpisode = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      dispatch({ type: 'UPDATE_EPISODE', episode: trimmed });
      void fetch(`/api/sessions/${sessionId}/episode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode: trimmed }),
      }).catch(err => {
        console.error('[Session] Failed to update episode:', err);
      });
    }
    setEditingEpisode(false);
  }, [dispatch, sessionId]);

  const startEpisodeEdit = useCallback(() => {
    setEpisodeInput(episodeName);
    setEditingEpisode(true);
    setTimeout(() => {
      episodeInputRef.current?.focus();
      episodeInputRef.current?.select();
    }, 0);
  }, [episodeName]);

  const saveName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      dispatch({ type: 'UPDATE_HOST_NAME', hostName: trimmed });
      void fetch(`/api/sessions/${sessionId}/participant`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      }).catch(err => {
        console.error('[Session] Failed to update display name:', err);
      });
    }
    setEditingName(false);
  }, [dispatch, sessionId]);

  const startNameEdit = useCallback(() => {
    setNameInput(hostName);
    setEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }, [hostName]);

  // Realtime recording sync
  const recordingStartRef = useRef<number>(0);

  const handleRemoteStart = useCallback(async (startedAt: number) => {
    console.log('[Recording] Remote host started recording at', startedAt);
    // Auto-start local recording to stay in sync
    if (!recording.state.isRecording) {
      try {
        await recording.startRecording();
        recordingStartRef.current = startedAt;
      } catch (err) {
        console.error('[Recording] Failed to auto-start:', err);
      }
    }
  }, [recording]);

  const handleRemoteStop = useCallback(async (startedAt: number, durationMs: number) => {
    console.log('[Recording] Remote host stopped recording', { startedAt, durationMs });
    // Auto-stop local recording
    if (recording.state.isRecording) {
      try {
        await recording.stopRecording();
      } catch (err) {
        console.error('[Recording] Failed to auto-stop:', err);
      }
    }
  }, [recording]);

  const { broadcastStart, broadcastStop } = useRecordingSync({
    sessionId,
    onRemoteStart: handleRemoteStart,
    onRemoteStop: handleRemoteStop,
  });

  const uploadTrack = useCallback(async (
    sessionId: string,
    episode: string,
    hostName: string,
    trackType: 'mic' | 'sounders',
    blob: Blob,
    startedAt: number,
  ) => {
    try {
      if (blob.size < 100) {
        console.log('[Recording] Skipping empty track:', trackType, blob.size);
        return true;
      }
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
        body: JSON.stringify({ sessionId, episode, hostName, trackType, startedAt, audioBase64: base64 }),
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return true;
    } catch (err) {
      console.error('[Recording] Upload error:', err);
      return false;
    }
  }, []);

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1800);
    } catch (err) {
      console.error('[Session] Failed to copy invite link:', err);
    }
  }, [inviteUrl]);

  // Unified start: session + audio recording + broadcast
  const handleStartRecording = async () => {
    // Request mic permission first
    const hasPermission = await recording.requestMicPermission();
    if (!hasPermission) return;
    setMicPermissionOk(true);

    const now = Date.now();
    recordingStartRef.current = now;

    // Start session recording (timeline for notes/cues/segments)
    dispatch({ type: 'START_RECORDING' });

    // Start WebRTC audio recording (mic + sounders)
    await recording.startRecording();

    // Broadcast to all hosts
    broadcastStart(now);
  };

  // Unified stop: session + audio recording + broadcast + upload
  const handleStopRecording = async () => {
    // Stop session recording
    dispatch({ type: 'STOP_RECORDING' });

    // Stop WebRTC audio recording
    const tracks = await recording.stopRecording();
    recordingStartRef.current = 0;

    // Broadcast stop to other hosts
    broadcastStop(tracks.startedAt, tracks.durationMs);

    // Upload both tracks
    setUploadStatus('uploading');
    uploadStatusRef.current = 'uploading';

    const [micOk, sounderOk] = await Promise.all([
      uploadTrack(sessionId, episodeName, hostName, 'mic', tracks.mic, tracks.startedAt),
      uploadTrack(sessionId, episodeName, hostName, 'sounders', tracks.sounders, tracks.startedAt),
    ]);

    const finalStatus = micOk && sounderOk ? 'done' : 'error';
    setUploadStatus(finalStatus);
    uploadStatusRef.current = finalStatus;

    setTimeout(() => {
      setUploadStatus('idle');
      uploadStatusRef.current = 'idle';
    }, 3000);
  };

  const isRecording = state.isRecording || recording.state.isRecording;

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="flex items-center gap-4">
        {/* Episode name — click to edit (only when not recording) */}
        {editingEpisode ? (
          <input
            ref={episodeInputRef}
            value={episodeInput}
            onChange={e => setEpisodeInput(e.target.value)}
            onBlur={() => saveEpisode(episodeInput)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveEpisode(episodeInput);
              if (e.key === 'Escape') setEditingEpisode(false);
            }}
            className="text-lg font-semibold tracking-tight px-2 py-0.5 rounded border border-[var(--accent)] bg-[var(--card-bg)] text-[var(--foreground)] w-48 focus:outline-none"
            placeholder="Episode title"
          />
        ) : (
          <button
            onClick={isRecording ? undefined : startEpisodeEdit}
            className={`text-lg font-semibold tracking-tight px-2 py-0.5 rounded border transition-colors ${
              isRecording
                ? 'border-transparent cursor-default'
                : 'border-transparent hover:border-[var(--card-border)] cursor-pointer hover:text-[var(--accent)]'
            }`}
            title={isRecording ? undefined : 'Click to edit episode title'}
          >
            {episodeName}
          </button>
        )}
        <span className="text-xs text-[var(--muted)]">{state.date}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* WebRTC Audio Recording Status */}
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
            <span className="text-xs text-[var(--muted)]">
              {micPermissionOk ? '🎙 Ready' : '🎙 Click Start'}
            </span>
          )}
        </div>

        {/* Sounder stop */}
        <button
          onClick={copyInvite}
          className="px-2 py-1.5 text-xs font-medium rounded border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
          title="Copy invite link"
        >
          {inviteCopied ? 'Copied' : 'Invite'}
        </button>

        {/* Sounder stop */}
        <button
          onClick={stopAll}
          className="px-2 py-1.5 text-xs font-medium rounded border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
          title="Stop all playing sounders"
        >
          ⏹
        </button>

        {/* Host name — click to edit */}
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={() => saveName(nameInput)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveName(nameInput);
              if (e.key === 'Escape') setEditingName(false);
            }}
            className="text-sm px-2 py-0.5 rounded border border-[var(--accent)] bg-[var(--card-bg)] text-[var(--foreground)] w-24 focus:outline-none"
            placeholder="Your name"
          />
        ) : (
          <button
            onClick={startNameEdit}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-2 py-0.5 rounded border border-transparent hover:border-[var(--card-border)]"
            title="Click to set your name"
          >
            {hostName}
          </button>
        )}

        {/* Session timer */}
        <div className={`font-mono text-xl font-bold tabular-nums ${isRecording ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>
          {isRecording ? formatElapsed(elapsedMs) : '--:--:--'}
        </div>

        {/* Unified Start/Stop Recording */}
        {isRecording ? (
          <button
            onClick={handleStopRecording}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--danger)] text-white hover:opacity-90 transition-opacity"
          >
            Stop Recording
          </button>
        ) : (
          <button
            onClick={handleStartRecording}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--success)] text-white hover:opacity-90 transition-opacity"
          >
            Start Recording
          </button>
        )}
      </div>
    </header>
  );
}
