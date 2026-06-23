import type { NextApiRequest, NextApiResponse } from 'next';
import { toSessionChannelName } from '@/lib/sessions/channel';
import { readSessionGrantsFromRequest } from '@/lib/sessions/cookies';
import { hasSessionAccess } from '@/lib/sessions/file-store';

async function getPusher() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) return null;

  const { default: Pusher } = await import('pusher');
  return new Pusher({ appId, key, secret, cluster, useTLS: true });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { sessionId, event } = req.body as {
    sessionId?: string;
    event?: Record<string, unknown>;
  };

  if (!sessionId || !event) {
    return res.status(400).json({ message: 'Missing sessionId or event' });
  }

  const grants = readSessionGrantsFromRequest(req);
  const grant = grants.find(candidate => candidate.sessionId === sessionId);
  const canAccess = await hasSessionAccess(sessionId, grant);

  if (!canAccess) {
    return res.status(403).json({ message: 'Session access denied' });
  }

  const pusher = await getPusher();
  if (!pusher) {
    return res.status(500).json({ message: 'Pusher not configured' });
  }

  try {
    const channelName = toSessionChannelName(sessionId);
    await pusher.trigger(`presence-${channelName}`, 'session-event', event);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Pusher] Signal error:', err);
    res.status(500).json({ message: 'Signal failed' });
  }
}
