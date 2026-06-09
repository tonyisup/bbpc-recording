import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient } from '@azure/storage-blob';

const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME_SOUNDERS || 'sounders';
const CONN_STR = process.env.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING;
const CONFIG_BLOB = 'segment-templates.json';

export interface SegmentTemplate {
  id: string;
  label: string;
  type: 'intro' | 'segment' | 'ad' | 'outro' | 'news' | 'interview';
  introSounder?: string; // blob path in sounders container, e.g. "Intros/Base.mp3"
  outroSounder?: string;
}

interface TemplateConfig {
  segmentTemplates: SegmentTemplate[];
}

function getBlobServiceClient() {
  if (!CONN_STR) throw new Error('AZURE_STORAGE_ACCOUNT_CONNECTION_STRING not set');
  return BlobServiceClient.fromConnectionString(CONN_STR);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const svc = getBlobServiceClient();
    const containerClient = svc.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(CONFIG_BLOB);

    const exists = await blobClient.exists();
    if (!exists) {
      // No config file yet — return empty templates
      return res.status(200).json({ segmentTemplates: [] });
    }

    const download = await blobClient.download();
    const chunks: Buffer[] = [];
    for await (const chunk of download.readableStreamBody as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const json = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as TemplateConfig;

    // Validate shape
    if (!Array.isArray(json.segmentTemplates)) {
      return res.status(200).json({ segmentTemplates: [] });
    }

    res.status(200).json({ segmentTemplates: json.segmentTemplates });
  } catch (err) {
    console.error('[SegmentTemplates] Error:', err);
    res.status(500).json({ message: 'Failed to load segment templates' });
  }
}
