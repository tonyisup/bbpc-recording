'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';

export interface PresenceMember {
  id: string;
  name: string;
}

interface UsePresenceOptions {
  channelName: string;
  hostName: string;
}

export function usePresence({ channelName, hostName }: UsePresenceOptions) {
  const [members, setMembers] = useState<Map<string, PresenceMember>>(new Map());
  const [connected, setConnected] = useState(false);
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<ReturnType<Pusher['subscribe']> | null>(null);

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
    channelRef.current = channel;

    channel.bind('pusher:subscription_succeeded', (data: { members: Record<string, { name: string }> }) => {
      console.log('[Pusher] Presence members:', data.members);
      const map = new Map<string, PresenceMember>();
      // Pusher members object: { socket_id: { name: ... } }
      for (const [id, info] of Object.entries(data.members)) {
        map.set(id, { id, name: info.name });
      }
      setMembers(map);
      setConnected(true);
    });

    channel.bind('pusher:subscription_error', (err: unknown) => {
      console.error('[Pusher] Presence subscription error:', err);
      setConnected(false);
    });

    channel.bind('pusher:member_added', (member: { id: string; info: { name: string } }) => {
      console.log('[Pusher] Member added:', member.info.name);
      setMembers(prev => {
        const next = new Map(prev);
        next.set(member.id, { id: member.id, name: member.info.name });
        return next;
      });
    });

    channel.bind('pusher:member_removed', (member: { id: string; info: { name: string } }) => {
      console.log('[Pusher] Member removed:', member.info?.name);
      setMembers(prev => {
        const next = new Map(prev);
        next.delete(member.id);
        return next;
      });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`presence-${channelName}`);
      pusher.disconnect();
      setConnected(false);
    };
  }, [channelName, hostName]);

  const memberList = Array.from(members.values());

  return { members: memberList, connected };
}
