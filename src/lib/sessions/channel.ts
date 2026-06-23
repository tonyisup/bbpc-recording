export function toSessionChannelName(sessionId: string): string {
  return `session-${sessionId}`;
}

export function parseSessionIdFromChannel(channelName: string): string | null {
  const prefix = 'presence-session-';
  if (!channelName.startsWith(prefix)) return null;
  const sessionId = channelName.slice(prefix.length);
  return sessionId.length > 0 ? sessionId : null;
}

