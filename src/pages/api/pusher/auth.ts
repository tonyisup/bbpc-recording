import type { NextApiRequest, NextApiResponse } from 'next';
import { parseSessionIdFromChannel } from '@/lib/sessions/channel';
import { readSessionGrantsFromRequest } from '@/lib/sessions/cookies';
import { getParticipantForGrant, updateParticipantDisplayName } from '@/lib/sessions/store';

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

  const socketId = req.body.socket_id as string;
  const channelName = req.body.channel_name as string;
  const username = (req.body.username as string) || 'anonymous';

  if (!socketId || !channelName) {
    return res.status(400).json({ message: 'Missing socket_id or channel_name' });
  }

  const sessionId = parseSessionIdFromChannel(channelName);
  if (!sessionId) {
    return res.status(403).json({ message: 'Unsupported channel' });
  }

  const grants = readSessionGrantsFromRequest(req);
  const grant = grants.find(candidate => candidate.sessionId === sessionId);
  if (!grant) {
    return res.status(403).json({ message: 'Session access denied' });
  }

  const participant = username.trim()
    ? await updateParticipantDisplayName(sessionId, grant, username)
    : await getParticipantForGrant(sessionId, grant);

  if (!participant) {
    return res.status(403).json({ message: 'Session access denied' });
  }

  const pusher = await getPusher();
  if (!pusher) {
    return res.status(500).json({ message: 'Pusher not configured' });
  }

  try {
    const auth = pusher.authorizeChannel(socketId, channelName, {
      user_id: participant.clientId,
      user_info: { name: participant.displayName },
    });
    res.status(200).json(auth);
  } catch (err) {
    console.error('[Pusher] Auth error:', err);
    res.status(500).json({ message: 'Auth failed' });
  }
}
