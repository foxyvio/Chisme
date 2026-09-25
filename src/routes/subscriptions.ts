import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth, userId } from '../auth.js';

const plans = { free: { maxFileBytes: 2_000_000_000n, maxGroupMembers: 200_000, maxDevices: 5, maxBots: 10, storageBytes: 10_000_000_000n }, plus: { maxFileBytes: 20_000_000_000n, maxGroupMembers: 1_000_000, maxDevices: 20, maxBots: 1_000_000, storageBytes: 2_000_000_000_000n } } as const;
export async function subscriptionRoutes(app: FastifyInstance) {
  app.get('/plans', async () => Object.entries(plans).map(([id, p]) => ({ id, ...p, maxFileBytes: p.maxFileBytes.toString(), storageBytes: p.storageBytes.toString() })));
  app.register(async instance => {
    instance.addHook('preHandler', requireAuth);
    instance.get('/me', async request => { const sub = await prisma.subscription.findFirst({ where: { userId: userId(request), status: { in: ['TRIALING', 'ACTIVE'] }, currentPeriodEnd: { gt: new Date() } }, include: { plan: true }, orderBy: { currentPeriodEnd: 'desc' } }); return sub ?? { planId: 'free', status: 'ACTIVE', plan: { id: 'free', ...plans.free } }; });
    instance.post('/activate', async (request, reply) => { const input = z.object({ planId: z.enum(['free', 'plus']), provider: z.string().max(40).optional(), providerSubscriptionId: z.string().max(200).optional() }).parse(request.body); const now = new Date(); const sub = await prisma.subscription.create({ data: { userId: userId(request), planId: input.planId, provider: input.provider, providerSubscriptionId: input.providerSubscriptionId, status: input.planId === 'free' ? 'ACTIVE' : 'TRIALING', currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000) }, include: { plan: true } }); return reply.code(201).send(sub); });
  }, { prefix: '/subscriptions' });
}

export async function entitlementFor(uid: string) { const active = await prisma.subscription.findFirst({ where: { userId: uid, status: { in: ['TRIALING', 'ACTIVE'] }, currentPeriodEnd: { gt: new Date() } }, include: { plan: true }, orderBy: { currentPeriodEnd: 'desc' } }); return active?.plan ?? { id: 'free', ...plans.free }; }
