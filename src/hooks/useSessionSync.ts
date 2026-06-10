'use client';

import { useEffect, useRef, useCallback } from 'react';
import Pusher from 'pusher-js';
import type { PusherEvent } from '@/types';

interface UseSessionSyncOptions {
  channelName: string;
  hostName: string;
  onRemoteEvent: (event: PusherEvent) => void;
}

/**
 * Subscribe to a Pusher presence channel for real-time session sync.
 *
 * Events are relayed through /api/pusher/signal (server-side trigger)
 * to avoid requiring Pusher client-event auth configuration.
 */
export function useSessionSync({ channelName, hostName, onRemoteEvent }: UseSessionSyncOptions) {
  const pusherRef = useRef<Pusher | null>(null);
  const onRemoteRef = useRef(onRemoteEvent);
  onRemoteRef.current = onRemoteEvent;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.warn('[Pusher] Env vars missing — running in local-only mode');
      return;
    }

    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
      auth: { params: { username: hostName } },
    });
    pusherRef.current = pusher;

    const channel = pusher.subscribe(`presence-${channelName}`);

    channel.bind('session-event', (data: PusherEvent) => {
      onRemoteRef.current(data);
    });

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`[Pusher] Subscribed to presence-${channelName}`);
    });

    channel.bind('pusher:subscription_error', (err: unknown) => {
      console.error('[Pusher] Subscription error:', err);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`presence-${channelName}`);
      pusher.disconnect();
    };
  }, [channelName, hostName]);

  const sendEvent = useCallback(async (event: PusherEvent) => {
    try {
      await fetch('/api/pusher/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, event }),
      });
    } catch (err) {
      console.error('[Pusher] Failed to send event:', err);
    }
  }, [channelName]);

  return { sendEvent };
}
