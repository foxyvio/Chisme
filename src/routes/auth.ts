import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../server.js';

const registerSchema = z.object({ username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/), displayName: z.string().min(1).max(80), password: z.string().min(10).max(200), device: z.object({ name: z.string().min(1).max(80), identityKey: z.string().min(20), signedPreKey: z.string().min(20), signedPreKeySig: z.string().min(20), preKeys: z.array(z.string().min(20)).min(1).max(100) }) });
const loginSchema = z.object({ username: z.string(), password: z.string(), deviceId: z.string().optional() });

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const exists = await prisma.user.findUnique({ where: { username: input.username.toLowerCase() } });
    if (exists) return reply.code(409).send({ error: 'username_taken' });
    const user = await prisma.user.create({ data: { username: input.username.toLowerCase(), displayName: input.displayName, passwordHash: await bcrypt.hash(input.password, 12), devices: { create: { name: input.device.name, identityKey: input.device.identityKey, signedPreKey: input.device.signedPreKey, signedPreKeySig: input.device.signedPreKeySig, preKeys: { create: input.device.preKeys.map(key => ({ key })) } } } }, include: { devices: true } });
    const device = user.devices[0];
    return reply.code(201).send({ user: { id: user.id, username: user.username, displayName: user.displayName }, deviceId: device.id, token: await app.jwt.sign({ sub: user.id, deviceId: device.id }) });
  });
  app.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { username: input.username.toLowerCase() }, include: { devices: true } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return reply.code(401).send({ error: 'invalid_credentials' });
    const device = user.devices.find(d => d.id === input.deviceId) ?? user.devices[0];
    await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return { user: { id: user.id, username: user.username, displayName: user.displayName }, deviceId: device.id, token: await app.jwt.sign({ sub: user.id, deviceId: device.id }) };
  });
}
