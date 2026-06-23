import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import {
  createAccessToken,
  createClientId,
  createInviteToken,
  createSessionId,
} from './ids';
import type {
  CreateSessionResult,
  JoinSessionResult,
  RecordingSession,
  SessionAccessGrant,
  SessionParticipant,
} from './types';

function sanitizeDisplayName(displayName: string | undefined, fallback: string): string {
  const normalized = displayName?.trim().replace(/\s+/g, ' ');
  if (!normalized) return fallback;
  return normalized.slice(0, 40);
}

function defaultEpisode(): string {
  return `EP-${new Date().toISOString().slice(0, 10)}`;
}

export async function createSession(displayName?: string): Promise<CreateSessionResult> {
  const now = Date.now();
  const clientId = createClientId();
  const accessToken = createAccessToken();
  const participant = {
    clientId,
    accessToken,
    displayName: sanitizeDisplayName(displayName, 'Host'),
    role: 'owner' as const,
    joinedAt: now,
  };

  const session = await fetchMutation(api.sessions.createSession, {
    publicId: createSessionId(),
    inviteToken: createInviteToken(),
    episode: defaultEpisode(),
    createdAt: now,
    participant,
  });

  return {
    session,
    grant: {
      sessionId: session.id,
      clientId,
      accessToken,
    },
  };
}

export async function getSession(sessionId: string): Promise<RecordingSession | null> {
  return await fetchQuery(api.sessions.getSession, { publicId: sessionId });
}

export async function joinSessionByInviteToken(
  inviteToken: string,
  displayName?: string,
): Promise<JoinSessionResult | null> {
  const now = Date.now();
  const participant = {
    clientId: createClientId(),
    accessToken: createAccessToken(),
    displayName: sanitizeDisplayName(displayName, 'Guest'),
    role: 'participant' as const,
    joinedAt: now,
  };

  const session = await fetchMutation(api.sessions.joinSessionByInviteToken, {
    inviteToken,
    participant,
  });

  if (!session) return null;

  return {
    session,
    participant: {
      ...participant,
      joinedAt: new Date(participant.joinedAt).toISOString(),
    },
    grant: {
      sessionId: session.id,
      clientId: participant.clientId,
      accessToken: participant.accessToken,
    },
  };
}

export async function hasSessionAccess(
  sessionId: string,
  grant: SessionAccessGrant | undefined,
): Promise<boolean> {
  return (await getParticipantForGrant(sessionId, grant)) !== null;
}

export async function getParticipantForGrant(
  sessionId: string,
  grant: SessionAccessGrant | undefined,
): Promise<SessionParticipant | null> {
  if (!grant || grant.sessionId !== sessionId) return null;

  return await fetchQuery(api.sessions.getParticipantForGrant, {
    publicId: sessionId,
    clientId: grant.clientId,
    accessToken: grant.accessToken,
  });
}

export async function updateParticipantDisplayName(
  sessionId: string,
  grant: SessionAccessGrant,
  displayName: string,
): Promise<SessionParticipant | null> {
  return await fetchMutation(api.sessions.updateParticipantDisplayName, {
    publicId: sessionId,
    clientId: grant.clientId,
    accessToken: grant.accessToken,
    displayName: sanitizeDisplayName(displayName, 'Guest'),
  });
}

export async function updateSessionEpisode(
  sessionId: string,
  grant: SessionAccessGrant | undefined,
  episode: string,
): Promise<{ id: string; episode: string } | null> {
  const participant = await getParticipantForGrant(sessionId, grant);
  if (!participant || participant.role !== 'owner') return null;

  return await fetchMutation(api.sessions.updateSessionEpisode, {
    publicId: sessionId,
    episode: episode.trim().slice(0, 80),
  });
}

export async function endSession(
  sessionId: string,
  grant: SessionAccessGrant | undefined,
): Promise<{ id: string; status: 'ended'; endedAt: string | null } | null> {
  const participant = await getParticipantForGrant(sessionId, grant);
  if (!participant || participant.role !== 'owner') return null;

  return await fetchMutation(api.sessions.endSession, {
    publicId: sessionId,
    endedAt: Date.now(),
  });
}
