import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient } from '@azure/storage-blob';
import type { Manifest } from '@/types';

const CONTAINER_NAME = 'manifests';

function getBlobServiceClient() {
  const connStr = process.env.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_ACCOUNT_CONNECTION_STRING not set');
  return BlobServiceClient.fromConnectionString(connStr);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const manifest = req.body as Manifest;

  if (!manifest || !manifest.episode) {
    return res.status(400).json({ message: 'Missing manifest or episode' });
  }

  try {
    const blobServiceClient = getBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

    // Create container if it doesn't exist
    await containerClient.createIfNotExists({ access: 'blob' });

    const blobName = `${manifest.episode}/session-manifest.json`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const json = JSON.stringify(manifest, null, 2);
    await blockBlobClient.upload(json, Buffer.byteLength(json), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      metadata: {
        episode: manifest.episode,
        date: manifest.date,
        hosts: manifest.hosts.join(','),
      },
    });

    res.status(200).json({
      ok: true,
      url: blockBlobClient.url,
      blobName,
    });
  } catch (err) {
    console.error('[Azure] Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
}
