'use client';

import { useSession } from './SessionProvider';
import { useAudio } from './AudioProvider';
import { useRecordingEngine } from '@/hooks/useRecordingEngine';

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
          style={{ height: `${(i + 1) * 100 / bars}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardHeader() {
  const { state, elapsedMs, dispatch } = useSession();
  const { stopAll } = useAudio();
  const recording = useRecordingEngine();

  const handleToggleRecording = async () => {
    if (recording.state.isRecording) {
      const tracks = await recording.stopRecording();
      console.log('[Recording] Stopped', {
        micSize: tracks.mic.size,
        sounderSize: tracks.sounders.size,
        durationMs: tracks.durationMs,
      });
      // TODO: upload tracks to Azure
    } else {
      const hasPermission = await recording.requestMicPermission();
      if (hasPermission) {
        await recording.startRecording();
      }
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
            </>
          ) : (
            <button
              onClick={handleToggleRecording}
              className="px-2 py-1 text-xs font-medium rounded border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
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
