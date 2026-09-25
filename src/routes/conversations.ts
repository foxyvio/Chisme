import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth, userId } from '../auth.js';
import { entitlementFor } from './subscriptions.js';

export async function conversationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', async (request, reply) => { const input = z.object({ type: z.enum(['DIRECT', 'GROUP', 'CHANNEL']), title: z.string().max(120).optional(), memberIds: z.array(z.string()).min(1).max(1_000_000) }).parse(request.body); const uid = userId(request); const ids = [...new Set([uid, ...input.memberIds])]; if (input.type === 'GROUP' && ids.length > (await entitlementFor(uid)).maxGroupMembers) return reply.code(413).send({ error: 'group_member_limit_reached' }); const c = await prisma.conversation.create({ data: { type: input.type, title: input.title, memberships: { create: ids.map(id => ({ userId: id, role: id === uid ? 'OWNER' : 'MEMBER' })) } }, include: { memberships: true } }); return reply.code(201).send(c); });
  app.get('/', async request => prisma.conversation.findMany({ where: { memberships: { some: { userId: userId(request) } } }, include: { memberships: { select: { userId: true, role: true } }, _count: { select: { messages: true } } }, orderBy: { updatedAt: 'desc' } }));
  app.get('/:id', async (request, reply) => { const { id } = z.object({ id: z.string() }).parse(request.params); const c = await prisma.conversation.findFirst({ where: { id, memberships: { some: { userId: userId(request) } } }, include: { memberships: true } }); return c ?? reply.code(404).send({ error: 'conversation_not_found' }); });
}
