import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  sessions: defineTable({
    publicId: v.string(),
    episode: v.string(),
    status: v.union(v.literal('active'), v.literal('ended')),
    createdAt: v.number(),
  }).index('by_public_id', ['publicId']),

  sessionInvites: defineTable({
    token: v.string(),
    sessionId: v.id('sessions'),
    publicSessionId: v.string(),
    createdAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_public_session_id', ['publicSessionId']),

  participants: defineTable({
    sessionId: v.id('sessions'),
    publicSessionId: v.string(),
    clientId: v.string(),
    accessToken: v.string(),
    displayName: v.string(),
    role: v.union(v.literal('owner'), v.literal('participant')),
    joinedAt: v.number(),
  })
    .index('by_public_session_id', ['publicSessionId'])
    .index('by_access', ['publicSessionId', 'clientId', 'accessToken']),
});

