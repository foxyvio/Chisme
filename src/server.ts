import 'dotenv/config';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';
import { authRoutes } from './routes/auth.js';
import { deviceRoutes } from './routes/devices.js';
import { conversationRoutes } from './routes/conversations.js';
import { messageRoutes } from './routes/messages.js';
import { registerWebsocket } from './realtime.js';

export const prisma = new PrismaClient();

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined } });
  await app.register(helmet);
  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') ?? false, credentials: true });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'development-only-secret' });
  await app.register(websocket);

  app.get('/health', async () => ({ status: 'ok', service: 'chisme-api', e2ee: 'client-side' }));
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(deviceRoutes, { prefix: '/v1/devices' });
  await app.register(conversationRoutes, { prefix: '/v1/conversations' });
  await app.register(messageRoutes, { prefix: '/v1/messages' });
  registerWebsocket(app);
  return app;
}

const app = await buildApp();
const shutdown = async () => { await app.close(); await prisma.$disconnect(); process.exit(0); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '0.0.0.0' });
