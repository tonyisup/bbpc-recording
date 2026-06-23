'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useState,
  useEffect,
  useId,
} from 'react';
import { useSessionSync } from '@/hooks/useSessionSync';
import type { SessionState, SessionAction, Manifest, Sounder, SessionSyncEvent } from '@/types';
import {
  actionToSyncEvent,
  createInitialState,
  sessionReducer,
  sessionStateToManifest,
  syncEventToAction,
} from '@/lib/session-state';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  elapsedMs: number;
  toManifest: () => Manifest;
  sessionId: string;
  inviteUrl: string;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
  sessionId: string;
  inviteUrl: string;
  episode?: string;
  date?: string;
  hostName?: string;
  sounders?: Sounder[];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SessionProvider({
  children,
  sessionId,
  inviteUrl,
  episode = 'EP-NEW',
  date = new Date().toISOString().slice(0, 10),
  hostName = 'host',
  sounders = [],
}: SessionProviderProps) {
  const [state, rawDispatch] = useReducer(
    sessionReducer,
    null,
    () => createInitialState(episode, date, hostName, sounders)
  );

  // Elapsed timer
  const [elapsedMs, setElapsedMs] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!state.isRecording || state.recordingStart === null) {
      setElapsedMs(0);
      return;
    }
    const tick = () => {
      setElapsedMs(Date.now() - state.recordingStart!);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.isRecording, state.recordingStart]);

  const reactId = useId();
  const sessionIdRef = useRef(`sess-${reactId}`);

  const handleRemoteEvent = useCallback((event: SessionSyncEvent) => {
    if (event.from === sessionIdRef.current) return;
    const action = syncEventToAction(event);
    if (action) rawDispatch(action);
  }, []);

  const { sendEvent } = useSessionSync({
    sessionId,
    onRemoteEvent: handleRemoteEvent,
  });

  // Wrapped dispatch: local + broadcast
  const dispatch = useCallback((action: SessionAction) => {
    rawDispatch(action);
    const event = actionToSyncEvent(action, state.hostName, state.recordingStart, sessionIdRef.current);
    if (event) sendEvent(event);
  }, [rawDispatch, sendEvent, state.hostName, state.recordingStart]);

  const toManifest = useCallback(
    (): Manifest => sessionStateToManifest(state, sessionId, elapsedMs),
    [state, elapsedMs, sessionId],
  );

  return (
    <SessionContext.Provider value={{ state, dispatch, elapsedMs, toManifest, sessionId, inviteUrl }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
