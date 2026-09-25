# Chisme backend

Privacy-first backend for Chisme, an alternative to Telegram. The server is deliberately **zero-knowledge for message content**: clients encrypt plaintext before calling the API. The API stores and relays ciphertext, nonces, and public key material only.

## Included foundation

- Password authentication with Argon2-ready password boundary (bcrypt currently used for portability)
- Multi-device identity keys, signed pre-keys, and one-time pre-key bundles
- Direct chats, groups, and channels with membership roles
- Encrypted message storage, pagination, client idempotency, replies, expiry metadata, edit/delete-ready schema
- WebSocket realtime delivery
- PostgreSQL schema with indexes and cascading membership cleanup
- Helmet, CORS, rate limiting, validation, and graceful shutdown

## Quick start

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

API starts at `http://localhost:3000`. Health: `GET /health`.

## E2EE contract

Use a proven audited protocol in clients (for example, Signal's Double Ratchet / Sesame design or MLS for groups). Do **not** implement cryptography in this server and do not send plaintext to it. The device endpoints publish public identity keys and pre-key material; `/v1/messages` accepts only ciphertext. Attachments should use client-side envelope encryption, with object storage receiving encrypted bytes and the API storing only opaque metadata.

## Roadmap for Telegram-class features

1. Production E2EE clients: key verification/safety numbers, key rotation, disappearing messages, encrypted attachments, encrypted push payloads, and encrypted group sessions.
2. Durable delivery: offline queue, per-device delivery/read receipts, retry/ack protocol, and push notifications with no message content.
3. Communities: invite links, moderation/audit events, polls, scheduled messages, pinned messages, topics, and broadcast channels.
4. Calls: WebRTC SFU with end-to-end media encryption, voice rooms, screen sharing, and call signaling over the realtime service.
5. Platform: encrypted object storage, search over local client indexes, bot sandbox with explicit user consent, abuse controls, observability, backups, and independent security audits.

Telegram's cloud chats are not end-to-end encrypted by default; Chisme's key product decision is the opposite: E2EE by default, with server features designed around that constraint.

## Security notes before production

- Replace bcrypt with Argon2id and add email/phone verification, recovery, 2FA, refresh-token rotation, and account lockout.
- Add CSRF protection if browser cookies are introduced; prefer short-lived access tokens and secure refresh tokens.
- Put WebSockets behind authentication middleware, a connection limit, and a pub/sub adapter (Redis/NATS) for multiple API instances.
- Never log request bodies, ciphertext, tokens, private keys, or push payloads.
- Add abuse prevention, content-reporting flows that respect E2EE limitations, key transparency, dependency scanning, threat modeling, and an external audit.
