import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth, userId, deviceId, requireMembership } from '../auth.js';
import { broadcast } from '../realtime.js';

const message = z.object({ conversationId: z.string(), clientMessageId: z.string().min(1).max(128), ciphertext: z.string().min(1).max(10_000_000), nonce: z.string().min(8), algorithm: z.string().default('xchacha20-poly1305'), replyToId: z.string().optional(), expiresAt: z.coerce.date().optional() });
export async function messageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', async (request, reply) => { const input = message.parse(request.body); const uid = userId(request); if (!await requireMembership(input.conversationId, uid)) return reply.code(403).send({ error: 'not_a_member' }); const saved = await prisma.message.create({ data: { ...input, senderId: uid, senderDeviceId: deviceId(request) } }); const event = { type: 'message.new', message: saved }; broadcast(input.conversationId, event); return reply.code(201).send(saved); });
  app.get('/:conversationId', async (request, reply) => { const { conversationId } = z.object({ conversationId: z.string() }).parse(request.params); if (!await requireMembership(conversationId, userId(request))) return reply.code(403).send({ error: 'not_a_member' }); const q = z.object({ before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query); return prisma.message.findMany({ where: { conversationId, ...(q.before ? { createdAt: { lt: q.before } } : {}) }, orderBy: { createdAt: 'desc' }, take: q.limit }); });
  app.delete('/:id', async (request, reply) => { const { id } = z.object({ id: z.string() }).parse(request.params); const m = await prisma.message.findUnique({ where: { id } }); if (!m || m.senderId !== userId(request)) return reply.code(404).send({ error: 'message_not_found' }); await prisma.message.update({ where: { id }, data: { deletedAt: new Date(), ciphertext: '', nonce: '' } }); broadcast(m.conversationId, { type: 'message.deleted', messageId: id }); return { ok: true }; });
}
