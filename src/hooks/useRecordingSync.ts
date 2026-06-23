'use client';

import { useCallback, useId, useRef } from 'react';
import { useSessionSync } from './useSessionSync';
import type { PusherEvent } from '@/types';
import type Pusher from 'pusher-js';

interface RecordingSyncOptions {
  sessionId: string;
  channelName: string;
  hostName: string;
  onRemoteStart: (startedAt: number) => void;
  onRemoteStop: (startedAt: number, durationMs: number) => void;
  existingChannel?: ReturnType<Pusher['subscribe']> | null;
}

/**
 * Syncs recording start/stop events across hosts via Pusher.
 * When one host starts/stops recording, others receive the event
 * and can align their local recording timestamps.
 */
export function useRecordingSync({
  channelName,
  sessionId,
  hostName,
  onRemoteStart,
  onRemoteStop,
  existingChannel,
}: RecordingSyncOptions) {
  const reactId = useId();
  const sessionIdRef = useRef(`rec-${reactId}`);

  const handleRemoteEvent = useCallback((event: PusherEvent) => {
    if (event.kind === 'recording-started' && event.from !== sessionIdRef.current) {
      onRemoteStart(event.startedAt);
    }
    if (event.kind === 'recording-stopped' && event.from !== sessionIdRef.current) {
      onRemoteStop(event.startedAt, event.durationMs);
    }
  }, [onRemoteStart, onRemoteStop]);

  const { sendEvent } = useSessionSync({
    sessionId,
    channelName,
    hostName,
    onRemoteEvent: handleRemoteEvent,
    existingChannel,
  });

  const broadcastStart = useCallback((startedAt: number) => {
    sendEvent({ kind: 'recording-started', startedAt, from: sessionIdRef.current });
  }, [sendEvent]);

  const broadcastStop = useCallback((startedAt: number, durationMs: number) => {
    sendEvent({ kind: 'recording-stopped', startedAt, durationMs, from: sessionIdRef.current });
  }, [sendEvent]);

  return { broadcastStart, broadcastStop };
}
