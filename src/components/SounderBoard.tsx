'use client';

import { useSession } from './SessionProvider';
import type { Sounder } from '@/types';
import { useMemo } from 'react';

export function SounderBoard() {
  const { state, dispatch, elapsedMs } = useSession();

  const categories = useMemo(() => {
    const map = new Map<string, Sounder[]>();
    for (const s of state.sounders) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [state.sounders]);

  const handleTrigger = (sounder: Sounder) => {
    dispatch({ type: 'TRIGGER_SOUNDER', sounder });
  };

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Sounders
        {state.soundersUsed.length > 0 && (
          <span className="ml-2 text-[var(--accent)] font-normal normal-case">
            ({state.soundersUsed.length} played)
          </span>
        )}
      </h2>

      {Array.from(categories.entries()).map(([category, sounders]) => (
        <div key={category}>
          <h3 className="text-xs font-medium text-[var(--muted)] mb-2">{category}</h3>
          <div className="grid grid-cols-3 gap-2">
            {sounders.map(s => (
              <button
                key={s.id}
                onClick={() => handleTrigger(s)}
                className={`
                  relative px-3 py-3 text-sm font-medium rounded-lg border transition-all
                  ${s.playing
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-white animate-pulse'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)]/50 hover:bg-[var(--card-bg)]/80'}
                `}
              >
                <span className="block truncate">{s.name}</span>
                <span className="block text-[10px] text-[var(--muted)] mt-0.5">
                  {(s.duration / 1000).toFixed(1)}s
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {state.soundersUsed.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--card-border)]">
          <h3 className="text-xs font-medium text-[var(--muted)] mb-2">History</h3>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {state.soundersUsed.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="font-mono tabular-nums w-16">
                  {(s.played_at_ms / 1000).toFixed(1)}s
                </span>
                <span className="truncate">{s.name}</span>
                <span className="ml-auto text-[var(--muted)]/60">{s.played_by}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
