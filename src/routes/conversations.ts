import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth, userId } from '../auth.js';

export async function conversationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', async (request, reply) => { const input = z.object({ type: z.enum(['DIRECT', 'GROUP', 'CHANNEL']), title: z.string().max(120).optional(), memberIds: z.array(z.string()).min(1).max(1000) }).parse(request.body); const uid = userId(request); const ids = [...new Set([uid, ...input.memberIds])]; const c = await prisma.conversation.create({ data: { type: input.type, title: input.title, memberships: { create: ids.map((id, i) => ({ userId: id, role: id === uid ? 'OWNER' : 'MEMBER' })) } }, include: { memberships: true } }); return reply.code(201).send(c); });
  app.get('/', async request => { const uid = userId(request); return prisma.conversation.findMany({ where: { memberships: { some: { userId: uid } } }, include: { memberships: { select: { userId: true, role: true } }, _count: { select: { messages: true } } }, orderBy: { updatedAt: 'desc' } }); });
  app.get('/:id', async (request, reply) => { const { id } = z.object({ id: z.string() }).parse(request.params); const c = await prisma.conversation.findFirst({ where: { id, memberships: { some: { userId: userId(request) } } }, include: { memberships: true } }); return c ? c : reply.code(404).send({ error: 'conversation_not_found' }); });
}
