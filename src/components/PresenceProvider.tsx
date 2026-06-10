'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';

export interface PresenceMember {
  id: string;
  name: string;
}

interface PresenceContextValue {
  members: PresenceMember[];
  connected: boolean;
  channel: ReturnType<Pusher['subscribe']> | null;
  resetConnections: () => void;
}

const PresenceContext = createContext<PresenceContextValue>({
  members: [],
  connected: false,
  channel: null,
  resetConnections: () => {},
});

interface PresenceProviderProps {
  children: React.ReactNode;
  channelName: string;
  hostName: string;
}

/**
 * Single Pusher presence connection shared across the app.
 * Deduplicates members by name to handle stale socket entries from
 * React Strict Mode double-mounts, HMR, etc.
 */
export function PresenceProvider({ children, channelName, hostName }: PresenceProviderProps) {
  const [members, setMembers] = useState<Map<string, PresenceMember>>(new Map());
  const [connected, setConnected] = useState(false);
  const [channel, setChannel] = useState<ReturnType<Pusher['subscribe']> | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const pusherRef = useRef<Pusher | null>(null);

  // Deduplicate helper: keeps only one entry per name (latest wins)
  const dedupByName = (map: Map<string, PresenceMember>): Map<string, PresenceMember> => {
    const seen = new Map<string, PresenceMember>();
    for (const member of map.values()) {
      seen.set(member.name.toLowerCase(), member);
    }
    return seen;
  };

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.warn('[Pusher] Env vars missing — running in local-only mode');
      return;
    }

    console.log('[Pusher] Connecting as:', hostName);
    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
      auth: { params: { username: hostName } },
    });
    pusherRef.current = pusher;

    const ch = pusher.subscribe(`presence-${channelName}`);

    ch.bind('pusher:subscription_succeeded', (data: { members: Record<string, { name: string }> }) => {
      console.log('[Pusher] Raw members from Pusher:', Object.keys(data.members).length, Object.values(data.members).map(m => m.name));
      const map = new Map<string, PresenceMember>();
      for (const [id, info] of Object.entries(data.members)) {
        map.set(id, { id, name: info.name });
      }
      setMembers(dedupByName(map));
      setConnected(true);
      setChannel(ch);
    });

    ch.bind('pusher:subscription_error', (err: unknown) => {
      console.error('[Pusher] Presence subscription error:', err);
      setConnected(false);
    });

    ch.bind('pusher:member_added', (member: { id: string; info: { name: string } }) => {
      console.log('[Pusher] Member added:', member.info.name);
      setMembers(prev => {
        const next = new Map(prev);
        // Remove any existing entry with the same name (stale socket from HMR/StrictMode)
        const existing = Array.from(next.values()).find(m => m.name === member.info.name);
        if (existing) {
          next.delete(existing.id);
        }
        next.set(member.id, { id: member.id, name: member.info.name });
        return dedupByName(next);
      });
    });

    ch.bind('pusher:member_removed', (member: { id: string }) => {
      console.log('[Pusher] Member removed:', member.id);
      setMembers(prev => {
        const next = new Map(prev);
        next.delete(member.id);
        return dedupByName(next);
      });
    });

    return () => {
      console.log('[Pusher] Disconnecting');
      ch.unbind_all();
      pusher.unsubscribe(`presence-${channelName}`);
      pusher.disconnect();
      setConnected(false);
      setChannel(null);
    };
  }, [channelName, hostName, resetCounter]);

  const resetConnections = () => {
    console.log('[Pusher] Resetting connections');
    // Disconnect current connection
    if (pusherRef.current) {
      pusherRef.current.disconnect();
    }
    setMembers(new Map());
    setConnected(false);
    setChannel(null);
    // Trigger re-connect via useEffect dependency
    setResetCounter(c => c + 1);
  };

  const memberList = Array.from(members.values());

  return (
    <PresenceContext.Provider value={{ members: memberList, connected, channel, resetConnections }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext);
}
