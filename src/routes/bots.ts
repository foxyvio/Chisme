import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../server.js';
import { requireAuth, userId, requireMembership } from '../auth.js';
import { entitlementFor } from './subscriptions.js';

export async function botRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', async (request, reply) => { const input = z.object({ username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+_bot$/), displayName: z.string().min(1).max(80), webhookUrl: z.string().url().optional(), conversationId: z.string().optional() }).parse(request.body); const uid = userId(request); const plan = await entitlementFor(uid); const count = await prisma.bot.count({ where: { ownerId: uid, status: 'ACTIVE' } }); if (count >= plan.maxBots) return reply.code(403).send({ error: 'bot_limit_reached', limit: plan.maxBots }); if (input.conversationId && !await requireMembership(input.conversationId, uid)) return reply.code(403).send({ error: 'not_a_member' }); const token = randomBytes(32).toString('base64url'); const bot = await prisma.bot.create({ data: { ...input, ownerId: uid, tokenHash: createHash('sha256').update(token).digest('hex'), permissions: { receiveMessages: true, sendMessages: true } } }); return reply.code(201).send({ bot, token }); });
  app.get('/', async request => prisma.bot.findMany({ where: { ownerId: userId(request) }, select: { id: true, username: true, displayName: true, webhookUrl: true, status: true, permissions: true, createdAt: true } }));
  app.delete('/:id', async (request, reply) => { const { id } = z.object({ id: z.string() }).parse(request.params); const bot = await prisma.bot.updateMany({ where: { id, ownerId: userId(request) }, data: { status: 'DISABLED' } }); return bot.count ? { ok: true } : reply.code(404).send({ error: 'bot_not_found' }); });
}
