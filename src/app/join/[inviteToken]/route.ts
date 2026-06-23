import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { joinSessionByInviteToken } from '@/lib/sessions/file-store';
import {
  SESSION_GRANTS_COOKIE,
  readSessionGrantsFromCookieValue,
  sessionGrantCookieOptions,
  upsertSessionGrant,
} from '@/lib/sessions/cookies';

export async function GET(
  request: Request,
  context: { params: Promise<{ inviteToken: string }> },
) {
  const { inviteToken } = await context.params;
  const result = await joinSessionByInviteToken(inviteToken);

  if (!result) {
    return new Response('Invite link is invalid or expired.', { status: 404 });
  }

  const cookieStore = await cookies();
  const grants = upsertSessionGrant(
    readSessionGrantsFromCookieValue(cookieStore.get(SESSION_GRANTS_COOKIE)?.value),
    result.grant,
  );
  const response = NextResponse.redirect(new URL(`/sessions/${result.session.id}`, request.url));

  response.cookies.set(
    SESSION_GRANTS_COOKIE,
    Buffer.from(JSON.stringify(grants), 'utf8').toString('base64url'),
    sessionGrantCookieOptions,
  );

  return response;
}
