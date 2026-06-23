'use client';

import { useEffect, useRef, useCallback } from 'react';
import Pusher from 'pusher-js';
import type { PusherEvent } from '@/types';

interface UseSessionSyncOptions {
  sessionId: string;
  channelName: string;
  hostName: string;
  onRemoteEvent: (event: PusherEvent) => void;
  existingChannel?: ReturnType<Pusher['subscribe']> | null;
}

/**
 * Subscribe to a Pusher presence channel for real-time session sync.
 *
 * If `existingChannel` is provided (from PresenceProvider), reuses that connection
 * instead of creating a new one. This prevents duplicate presence entries.
 *
 * Events are relayed through /api/pusher/signal (server-side trigger).
 */
export function useSessionSync({ sessionId, channelName, hostName, onRemoteEvent, existingChannel }: UseSessionSyncOptions) {
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<ReturnType<Pusher['subscribe']> | null>(null);
  const onRemoteRef = useRef(onRemoteEvent);

  useEffect(() => {
    onRemoteRef.current = onRemoteEvent;
  }, [onRemoteEvent]);

  useEffect(() => {
    // If we already have a channel from PresenceProvider, just bind to it
    if (existingChannel) {
      channelRef.current = existingChannel;
      existingChannel.bind('session-event', (data: PusherEvent) => {
        onRemoteRef.current(data);
      });
      return () => {
        existingChannel.unbind('session-event');
      };
    }

    // Otherwise create our own Pusher connection
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.warn('[Pusher] Env vars missing — running in local-only mode');
      return;
    }

    console.log('[Pusher] Creating own connection for', channelName);
    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
      auth: { params: { username: hostName } },
    });
    pusherRef.current = pusher;

    const channel = pusher.subscribe(`presence-${channelName}`);
    channelRef.current = channel;

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
      console.log('[Pusher] Cleaning up own connection for', channelName);
      channel.unbind_all();
      pusher.unsubscribe(`presence-${channelName}`);
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [channelName, hostName, existingChannel]);

  const sendEvent = useCallback(async (event: PusherEvent) => {
    try {
      await fetch('/api/pusher/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, event }),
      });
    } catch (err) {
      console.error('[Pusher] Failed to send event:', err);
    }
  }, [sessionId]);

  return { sendEvent };
}
