import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import type { Manifest } from '@/types';

export async function saveManifest(manifest: Manifest): Promise<string> {
  if (!manifest.session_id) {
    throw new Error('Manifest is missing session_id');
  }

  return await fetchMutation(api.manifests.save, {
    publicSessionId: manifest.session_id,
    episode: manifest.episode,
    date: manifest.date,
    hosts: manifest.hosts,
    manifestVersion: manifest.manifest_version,
    manifest,
    updatedAt: Date.now(),
  });
}

export async function getManifestForSession(sessionId: string): Promise<Manifest | null> {
  const saved = await fetchQuery(api.manifests.getBySession, {
    publicSessionId: sessionId,
  });

  return saved?.manifest as Manifest | null;
}

