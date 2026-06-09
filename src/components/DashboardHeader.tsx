'use client';

import { useSession } from './SessionProvider';

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function DashboardHeader() {
  const { state, elapsedMs, dispatch } = useSession();

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight">{state.episode}</h1>
        <span className="text-xs text-[var(--muted)]">{state.date}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--muted)]">{state.hostName}</span>

        <div className={`font-mono text-xl font-bold tabular-nums ${state.isRecording ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>
          {state.isRecording ? formatElapsed(elapsedMs) : '--:--:--'}
        </div>

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
