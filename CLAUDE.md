# OmniChat — Agent Playbook

Start with **[README.md](README.md)** and **[DOCS.md](DOCS.md)** for humans. This file is for coding agents.

**Product:** one Omni dashboard to connect **LINE** and **WhatsApp** with their API keys, then receive and send from a single inbox. Agents reply; there is **no customer-facing Claude reply**. **Facebook and WeChat are deferred** — do not implement until explicitly asked.

`ANTHROPIC_API_KEY` is not required. Leave `AI_ENABLED=false`.

## Cursor rules

File-scoped guidance for future changes lives in `.cursor/rules/`:

- `omni-core.mdc` — product + additive checklist (always on)
- `backend-adapters.mdc` / `frontend-react.mdc` / `api-socket-contracts.mdc` — live contracts
- `add-platform.mdc` — new channels without breaking LINE/WhatsApp
- `env-secrets.mdc` — keys in `.env` only

## Live path vs unused path

Production traffic is **`src/server.js`**. Incoming LINE/WhatsApp webhooks store the message, emit Socket.IO events (`new_message`, `message_received`, `user_message`, …), and outbound replies go through `sendMessageToUser` / `sendWhatsAppMessage` (same as `POST /api/send-message-to-user`).

`src/core/MessagePipeline.js` and `src/core/ServerManager.js` are **not** on the live webhook path. Do not “fix” routing by moving webhooks through them.

Frontend: `omni-react-app/` (Zustand `chatStore`, Socket.IO client). Dashboard chat load/send lives there; do not refactor it to add features.

## Commands

```bash
npm run dev:all          # backend + frontend + ngrok
npm start                # backend only (src/server.js)
cd omni-react-app && npm run dev
npm test
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Health: `GET /api/health`

## Secrets

- Real keys live in `.env` only. `.env` is gitignored and dockerignored.
- Copy `env.example` → `.env`. Example files must use placeholders, never real tokens.
- Do not put tokens in `docker-compose*.yml`, source, or docs. Compose reads LINE/WhatsApp keys from `.env` via `env_file`.
- `src/config/secrets.js` is the only helper for reading secrets. Logs are redacted (`[REDACTED]`). Never `console.log` API keys or generated `ENCRYPTION_KEY`.

## Non-negotiables

- Additive changes only. Do not rewrite webhooks, adapters, or `chatStore` send/load.
- Do not rename or remove Socket.IO events or existing send APIs.
- Do not change `AutoResponsePanel` template auto-response.
- New behavior behind feature flags, default **off**. Missing env must not break chat.
- Failures in new code are logged and swallowed. Webhook handlers must still return as they do today.

## AI module (`src/ai/`) — unused for product replies

Sidecar is **off**. Do not enable it for this Omni LINE/WhatsApp inbox. Do not add Claude auto-send to customers.
