import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient } from '@azure/storage-blob';
import { fetchMutation } from 'convex/nextjs';
import { api } from '../../../../convex/_generated/api';
import { readSessionGrantsFromRequest } from '@/lib/sessions/cookies';
import { hasSessionAccess } from '@/lib/sessions/store';

const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME_RECORDINGS || 'recordings';
const CONN_STR = process.env.AZURE_STORAGE_ACCOUNT_CONNECTION_STRING;
const RECORDING_CONTENT_TYPE = 'audio/webm';

function getBlobServiceClient() {
  if (!CONN_STR) throw new Error('AZURE_STORAGE_ACCOUNT_CONNECTION_STRING not set');
  return BlobServiceClient.fromConnectionString(CONN_STR);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { sessionId, episode, hostName, trackType, startedAt, audioBase64 } = req.body as {
      sessionId?: string;
      episode?: string;
      hostName?: string;
      trackType?: 'mic' | 'sounders';
      startedAt?: number;
      audioBase64?: string;
    };

    if (!episode || !hostName || !trackType || !startedAt) {
      console.error('[Recording Upload] Missing fields:', {
        hasEpisode: !!episode,
        hasHostName: !!hostName,
        hasTrackType: !!trackType,
        hasStartedAt: !!startedAt,
        hasAudioBase64: !!audioBase64,
        bodyKeys: Object.keys(req.body || {}),
      });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!audioBase64 || audioBase64.length === 0) {
      console.log('[Recording Upload] Empty audio, skipping:', { episode, hostName, trackType });
      return res.status(200).json({ ok: true, skipped: true, reason: 'empty audio' });
    }

    if (sessionId) {
      const grant = readSessionGrantsFromRequest(req).find(candidate => candidate.sessionId === sessionId);
      const canAccess = await hasSessionAccess(sessionId, grant);

      if (!canAccess) {
        return res.status(403).json({ message: 'Session access denied' });
      }
    }

    const svc = getBlobServiceClient();
    const containerClient = svc.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists({ access: 'blob' });

    const timestamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-');
    const blobName = `${sessionId || episode}/${timestamp}/${hostName}-${trackType}.webm`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    console.log('[Recording Upload] Uploading', {
      blobName,
      sizeBytes: audioBuffer.length,
      episode,
      hostName,
      trackType,
    });

    await blockBlobClient.upload(audioBuffer, audioBuffer.length, {
      blobHTTPHeaders: { blobContentType: RECORDING_CONTENT_TYPE },
      metadata: {
        episode,
        sessionId: sessionId || '',
        hostName,
        trackType,
        startedAt: String(startedAt),
      },
    });

    console.log('[Recording Upload] Success:', { blobName, size: audioBuffer.length });

    const recordingId = await fetchMutation(api.recordings.saveUpload, {
      publicSessionId: sessionId || undefined,
      episode,
      hostName,
      trackType,
      startedAt,
      blobName,
      url: blockBlobClient.url,
      size: audioBuffer.length,
      contentType: RECORDING_CONTENT_TYPE,
      uploadedAt: Date.now(),
    });

    res.status(200).json({
      ok: true,
      url: blockBlobClient.url,
      blobName,
      size: audioBuffer.length,
      recordingId,
    });
  } catch (err) {
    console.error('[Recording Upload] Error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
}

// Increase body size limit for audio uploads (default is 1mb)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '150mb',
    },
  },
};
