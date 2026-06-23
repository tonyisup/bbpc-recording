import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const saveUpload = mutation({
  args: {
    publicSessionId: v.optional(v.string()),
    episode: v.string(),
    hostName: v.string(),
    trackType: v.union(v.literal('mic'), v.literal('sounders')),
    startedAt: v.number(),
    blobName: v.string(),
    url: v.string(),
    size: v.number(),
    contentType: v.string(),
    uploadedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('recordingUploads')
      .withIndex('by_blob_name', q => q.eq('blobName', args.blobName))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert('recordingUploads', args);
  },
});

export const listBySession = query({
  args: {
    publicSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const uploads = await ctx.db
      .query('recordingUploads')
      .withIndex('by_public_session_id', q => q.eq('publicSessionId', args.publicSessionId))
      .collect();

    return uploads
      .sort((a, b) => a.startedAt - b.startedAt || a.hostName.localeCompare(b.hostName))
      .map(upload => ({
        id: upload._id,
        publicSessionId: upload.publicSessionId,
        episode: upload.episode,
        hostName: upload.hostName,
        trackType: upload.trackType,
        startedAt: upload.startedAt,
        blobName: upload.blobName,
        url: upload.url,
        size: upload.size,
        contentType: upload.contentType,
        uploadedAt: upload.uploadedAt,
      }));
  },
});
