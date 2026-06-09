import type { NextApiRequest, NextApiResponse } from 'next';

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

  const { channelName, event } = req.body as {
    channelName?: string;
    event?: Record<string, unknown>;
  };

  if (!channelName || !event) {
    return res.status(400).json({ message: 'Missing channelName or event' });
  }

  const pusher = await getPusher();
  if (!pusher) {
    return res.status(500).json({ message: 'Pusher not configured' });
  }

  try {
    await pusher.trigger(`presence-${channelName}`, 'session-event', event);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Pusher] Signal error:', err);
    res.status(500).json({ message: 'Signal failed' });
  }
}
