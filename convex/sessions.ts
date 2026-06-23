import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';

const role = v.union(v.literal('owner'), v.literal('participant'));

async function sessionByPublicId(ctx: QueryCtx | MutationCtx, publicId: string) {
  return await ctx.db
    .query('sessions')
    .withIndex('by_public_id', q => q.eq('publicId', publicId))
    .unique();
}

async function participantForAccess(
  ctx: QueryCtx | MutationCtx,
  publicSessionId: string,
  clientId: string,
  accessToken: string,
) {
  return await ctx.db
    .query('participants')
    .withIndex('by_access', q => (
      q
        .eq('publicSessionId', publicSessionId)
        .eq('clientId', clientId)
        .eq('accessToken', accessToken)
    ))
    .unique();
}

export const createSession = mutation({
  args: {
    publicId: v.string(),
    inviteToken: v.string(),
    episode: v.string(),
    createdAt: v.number(),
    participant: v.object({
      clientId: v.string(),
      accessToken: v.string(),
      displayName: v.string(),
      role,
      joinedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await sessionByPublicId(ctx, args.publicId);
    if (existing) {
      throw new Error('Session publicId already exists');
    }

    const sessionId = await ctx.db.insert('sessions', {
      publicId: args.publicId,
      episode: args.episode,
      status: 'active',
      createdAt: args.createdAt,
    });

    await ctx.db.insert('sessionInvites', {
      token: args.inviteToken,
      sessionId,
      publicSessionId: args.publicId,
      createdAt: args.createdAt,
    });

    await ctx.db.insert('participants', {
      sessionId,
      publicSessionId: args.publicId,
      ...args.participant,
    });

    return {
      id: args.publicId,
      inviteToken: args.inviteToken,
      episode: args.episode,
      createdAt: new Date(args.createdAt).toISOString(),
      status: 'active' as const,
      participants: [{
        ...args.participant,
        joinedAt: new Date(args.participant.joinedAt).toISOString(),
      }],
    };
  },
});

export const getSession = query({
  args: {
    publicId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await sessionByPublicId(ctx, args.publicId);
    if (!session) return null;

    const invite = await ctx.db
      .query('sessionInvites')
      .withIndex('by_public_session_id', q => q.eq('publicSessionId', args.publicId))
      .first();

    const participants = await ctx.db
      .query('participants')
      .withIndex('by_public_session_id', q => q.eq('publicSessionId', args.publicId))
      .collect();

    return {
      id: session.publicId,
      inviteToken: invite?.token ?? '',
      episode: session.episode,
      createdAt: new Date(session.createdAt).toISOString(),
      status: session.status,
      participants: participants.map(participant => ({
        clientId: participant.clientId,
        accessToken: participant.accessToken,
        displayName: participant.displayName,
        role: participant.role,
        joinedAt: new Date(participant.joinedAt).toISOString(),
      })),
    };
  },
});

export const joinSessionByInviteToken = mutation({
  args: {
    inviteToken: v.string(),
    participant: v.object({
      clientId: v.string(),
      accessToken: v.string(),
      displayName: v.string(),
      role,
      joinedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query('sessionInvites')
      .withIndex('by_token', q => q.eq('token', args.inviteToken))
      .unique();

    if (!invite) return null;

    const session = await ctx.db.get(invite.sessionId);
    if (!session || session.status !== 'active') return null;

    await ctx.db.insert('participants', {
      sessionId: invite.sessionId,
      publicSessionId: invite.publicSessionId,
      ...args.participant,
    });

    const participants = await ctx.db
      .query('participants')
      .withIndex('by_public_session_id', q => q.eq('publicSessionId', session.publicId))
      .collect();

    return {
      id: session.publicId,
      inviteToken: invite.token,
      episode: session.episode,
      createdAt: new Date(session.createdAt).toISOString(),
      status: session.status,
      participants: participants.map(participant => ({
        clientId: participant.clientId,
        accessToken: participant.accessToken,
        displayName: participant.displayName,
        role: participant.role,
        joinedAt: new Date(participant.joinedAt).toISOString(),
      })),
    };
  },
});

export const getParticipantForGrant = query({
  args: {
    publicId: v.string(),
    clientId: v.string(),
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await participantForAccess(ctx, args.publicId, args.clientId, args.accessToken);
    if (!participant) return null;

    return {
      clientId: participant.clientId,
      accessToken: participant.accessToken,
      displayName: participant.displayName,
      role: participant.role,
      joinedAt: new Date(participant.joinedAt).toISOString(),
    };
  },
});

export const updateParticipantDisplayName = mutation({
  args: {
    publicId: v.string(),
    clientId: v.string(),
    accessToken: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await participantForAccess(ctx, args.publicId, args.clientId, args.accessToken);
    if (!participant) return null;

    await ctx.db.patch(participant._id, { displayName: args.displayName });

    return {
      clientId: participant.clientId,
      accessToken: participant.accessToken,
      displayName: args.displayName,
      role: participant.role,
      joinedAt: new Date(participant.joinedAt).toISOString(),
    };
  },
});
