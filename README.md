# Chisme production-oriented backend

Chisme now has a scalable backend foundation for a privacy-first Telegram alternative.

## What was added

- **E2EE by default:** the API accepts ciphertext only; use an audited Signal Double Ratchet/Sesame implementation or MLS in clients.
- **Subscription entitlements:** Free and Plus plans, database-backed subscriptions, configurable device, storage, bot, file, and group limits.
- **Large encrypted files:** S3-compatible multipart uploads with presigned part URLs. The server never buffers files. Plus supports files up to 20 GB and groups up to 1,000,000 members.
- **Bots:** bot creation, hashed bot tokens, webhook URL, permissions, lifecycle status, and plan limits. Plus is configured for up to 1,000,000 bots per account, subject to abuse controls and infrastructure capacity.
- **Large groups:** membership schema and API validation support 1 lakh/10 lakh-scale groups; production deployments must shard fan-out and membership operations.
- **Realtime:** WebSocket delivery remains available for encrypted events.

## Run

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## Object storage setup

Create the bucket in S3, MinIO, Cloudflare R2, or another S3-compatible provider and configure the `S3_*` variables. Uploads use 64 MiB multipart parts and signed URLs; 20 GB requires at least 320 parts. Clients must encrypt the file before uploading and send only encrypted bytes. Store the file key in an E2EE message, never in this API.

## Subscription payments

`POST /v1/subscriptions/activate` is an entitlement-development endpoint, not a payment processor. For production, replace it with Stripe/Razorpay/etc. webhooks, verify signatures, make webhook handling idempotent, and allow only the provider to change paid subscription state.

## Production requirements before launch

This code is a strong backend foundation, not a claim that an internet-facing messaging service is automatically production-ready. Before serving real users, add:

- Redis/NATS pub-sub, queue workers, connection limits, and horizontal WebSocket scaling
- Sharded membership/fan-out, delivery/read receipts, offline queues, push notifications without plaintext, and backpressure
- Argon2id, refresh-token rotation, 2FA/passkeys, verification/recovery, account lockout, and device revocation
- Signed upload completion verification, malware scanning of encrypted metadata where possible, quota workers, orphan multipart cleanup, CDN downloads, and resumable retries
- Payment-provider webhooks, tax/invoice handling, refunds, and entitlement audit logs
- Bot rate limits, sandboxing, webhook retries/signatures, abuse prevention, moderation/reporting flows compatible with E2EE
- MLS/Signal client integration, key transparency, encrypted attachment key distribution, secure backups, threat modeling, load tests, dependency scanning, and an external security audit

Never log plaintext, private keys, access tokens, request bodies, or message ciphertext.
