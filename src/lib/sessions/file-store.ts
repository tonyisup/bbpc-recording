import { promises as fs } from 'fs';
import path from 'path';
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

const DATA_DIR = path.join(process.cwd(), '.data', 'sessions');

function sessionPath(sessionId: string): string {
  return path.join(DATA_DIR, `${sessionId}.json`);
}

function sanitizeDisplayName(displayName: string | undefined, fallback: string): string {
  const normalized = displayName?.trim().replace(/\s+/g, ' ');
  if (!normalized) return fallback;
  return normalized.slice(0, 40);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readSessionFile(filePath: string): Promise<RecordingSession | null> {
  try {
    const json = await fs.readFile(filePath, 'utf8');
    return JSON.parse(json) as RecordingSession;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function writeSession(session: RecordingSession): Promise<void> {
  await ensureDataDir();
  const filePath = sessionPath(session.id);
  await fs.writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

export async function createSession(displayName?: string): Promise<CreateSessionResult> {
  const now = new Date().toISOString();
  const clientId = createClientId();
  const accessToken = createAccessToken();
  const participant: SessionParticipant = {
    clientId,
    accessToken,
    displayName: sanitizeDisplayName(displayName, 'Host'),
    role: 'owner',
    joinedAt: now,
  };
  const session: RecordingSession = {
    id: createSessionId(),
    inviteToken: createInviteToken(),
    episode: `EP-${new Date().toISOString().slice(0, 10)}`,
    createdAt: now,
    status: 'active',
    participants: [participant],
  };

  await writeSession(session);

  return {
    session,
    grant: { sessionId: session.id, clientId, accessToken },
  };
}

export async function getSession(sessionId: string): Promise<RecordingSession | null> {
  return readSessionFile(sessionPath(sessionId));
}

export async function getSessionByInviteToken(inviteToken: string): Promise<RecordingSession | null> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const session = await readSessionFile(path.join(DATA_DIR, file));
    if (session?.inviteToken === inviteToken) return session;
  }

  return null;
}

export async function joinSessionByInviteToken(
  inviteToken: string,
  displayName?: string,
): Promise<JoinSessionResult | null> {
  const session = await getSessionByInviteToken(inviteToken);
  if (!session || session.status !== 'active') return null;

  const now = new Date().toISOString();
  const participant: SessionParticipant = {
    clientId: createClientId(),
    accessToken: createAccessToken(),
    displayName: sanitizeDisplayName(displayName, 'Guest'),
    role: 'participant',
    joinedAt: now,
  };

  const updatedSession = {
    ...session,
    participants: [...session.participants, participant],
  };
  await writeSession(updatedSession);

  return {
    session: updatedSession,
    participant,
    grant: {
      sessionId: updatedSession.id,
      clientId: participant.clientId,
      accessToken: participant.accessToken,
    },
  };
}

export async function hasSessionAccess(
  sessionId: string,
  grant: SessionAccessGrant | undefined,
): Promise<boolean> {
  if (!grant || grant.sessionId !== sessionId) return false;
  const session = await getSession(sessionId);
  if (!session || session.status !== 'active') return false;

  return session.participants.some(participant => (
    participant.clientId === grant.clientId
    && participant.accessToken === grant.accessToken
  ));
}

export async function getParticipantForGrant(
  sessionId: string,
  grant: SessionAccessGrant | undefined,
): Promise<SessionParticipant | null> {
  if (!grant || grant.sessionId !== sessionId) return null;
  const session = await getSession(sessionId);
  if (!session) return null;

  return session.participants.find(participant => (
    participant.clientId === grant.clientId
    && participant.accessToken === grant.accessToken
  )) ?? null;
}

export async function updateParticipantDisplayName(
  sessionId: string,
  grant: SessionAccessGrant,
  displayName: string,
): Promise<SessionParticipant | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const nextDisplayName = sanitizeDisplayName(displayName, 'Guest');
  let updatedParticipant: SessionParticipant | null = null;
  const participants = session.participants.map(participant => {
    if (
      participant.clientId !== grant.clientId
      || participant.accessToken !== grant.accessToken
    ) {
      return participant;
    }

    updatedParticipant = { ...participant, displayName: nextDisplayName };
    return updatedParticipant;
  });

  if (!updatedParticipant) return null;

  await writeSession({ ...session, participants });
  return updatedParticipant;
}

