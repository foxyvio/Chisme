import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth, userId } from '../auth.js';

const deviceSchema = z.object({ name: z.string().min(1).max(80), identityKey: z.string().min(20), signedPreKey: z.string().min(20), signedPreKeySig: z.string().min(20), preKeys: z.array(z.string().min(20)).min(1).max(100) });
export async function deviceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', async (request, reply) => { const input = deviceSchema.parse(request.body); const device = await prisma.device.create({ data: { ...input, userId: userId(request), preKeys: { create: input.preKeys.map(key => ({ key })) } } }); return reply.code(201).send({ id: device.id, name: device.name }); });
  app.get('/', async request => prisma.device.findMany({ where: { userId: userId(request) }, select: { id: true, name: true, identityKey: true, signedPreKey: true, signedPreKeySig: true, lastSeenAt: true } }));
  app.get('/:deviceId/prekey-bundle', async (request, reply) => { const params = z.object({ deviceId: z.string() }).parse(request.params); const device = await prisma.device.findUnique({ where: { id: params.deviceId }, include: { preKeys: { where: { usedAt: null }, take: 1 } } }); if (!device) return reply.code(404).send({ error: 'device_not_found' }); const preKey = device.preKeys[0]; if (preKey) await prisma.preKey.update({ where: { id: preKey.id }, data: { usedAt: new Date() } }); return { deviceId: device.id, identityKey: device.identityKey, signedPreKey: device.signedPreKey, signedPreKeySig: device.signedPreKeySig, oneTimePreKey: preKey?.key ?? null }; });
}
