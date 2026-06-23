import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../../convex/_generated/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const segmentTemplates = await fetchQuery(api.segmentTemplates.list, {});
    res.status(200).json({ segmentTemplates });
  } catch (err) {
    console.error('[SegmentTemplates] Error:', err);
    res.status(500).json({ message: 'Failed to load segment templates' });
  }
}
