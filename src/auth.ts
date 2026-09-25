import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './server.js';

export type AuthRequest = FastifyRequest & { user: { sub: string; deviceId: string } };
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try { await request.jwtVerify(); } catch { return reply.code(401).send({ error: 'unauthorized' }); }
}
export function userId(request: FastifyRequest) { return (request as AuthRequest).user.sub; }
export function deviceId(request: FastifyRequest) { return (request as AuthRequest).user.deviceId; }
export async function requireMembership(conversationId: string, uid: string) {
  return prisma.membership.findUnique({ where: { conversationId_userId: { conversationId, userId: uid } } });
}
