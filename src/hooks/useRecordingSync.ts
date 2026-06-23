'use client';

import { useCallback, useId, useRef } from 'react';
import { useSessionSync } from './useSessionSync';
import type { SessionSyncEvent } from '@/types';

interface RecordingSyncOptions {
  sessionId: string;
  onRemoteStart: (startedAt: number) => void;
  onRemoteStop: (startedAt: number, durationMs: number) => void;
}

/**
 * Syncs recording start/stop events across hosts via Convex session events.
 */
export function useRecordingSync({
  sessionId,
  onRemoteStart,
  onRemoteStop,
}: RecordingSyncOptions) {
  const reactId = useId();
  const sessionIdRef = useRef(`rec-${reactId}`);

  const handleRemoteEvent = useCallback((event: SessionSyncEvent) => {
    if (event.kind === 'recording-started' && event.from !== sessionIdRef.current) {
      onRemoteStart(event.startedAt);
    }
    if (event.kind === 'recording-stopped' && event.from !== sessionIdRef.current) {
      onRemoteStop(event.startedAt, event.durationMs);
    }
  }, [onRemoteStart, onRemoteStop]);

  const { sendEvent } = useSessionSync({
    sessionId,
    onRemoteEvent: handleRemoteEvent,
  });

  const broadcastStart = useCallback((startedAt: number) => {
    sendEvent({ kind: 'recording-started', startedAt, from: sessionIdRef.current });
  }, [sendEvent]);

  const broadcastStop = useCallback((startedAt: number, durationMs: number) => {
    sendEvent({ kind: 'recording-stopped', startedAt, durationMs, from: sessionIdRef.current });
  }, [sendEvent]);

  return { broadcastStart, broadcastStop };
}

