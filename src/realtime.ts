import type { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { prisma } from './server.js';

const clients = new Map<string, Set<SocketStream>>();
export function broadcast(conversationId: string, payload: unknown) { for (const socket of clients.get(conversationId) ?? []) { try { socket.socket.send(JSON.stringify(payload)); } catch { clients.get(conversationId)?.delete(socket); } } }
export function registerWebsocket(app: FastifyInstance) {
  app.get('/v1/realtime/:conversationId', { websocket: true }, async (socket, request) => {
    const conversationId = (request.params as { conversationId: string }).conversationId;
    const token = (request.query as { token?: string }).token;
    if (!token) return socket.socket.close(1008, 'token required');
    let claims: { sub: string };
    try { claims = app.jwt.verify(token) as { sub: string }; } catch { return socket.socket.close(1008, 'unauthorized'); }
    const membership = await prisma.membership.findUnique({ where: { conversationId_userId: { conversationId, userId: claims.sub } } });
    if (!membership) return socket.socket.close(1008, 'not a member');
    if (!clients.has(conversationId)) clients.set(conversationId, new Set());
    clients.get(conversationId)!.add(socket);
    socket.socket.on('close', () => { clients.get(conversationId)?.delete(socket); });
    socket.socket.send(JSON.stringify({ type: 'ready', conversationId }));
  });
}
