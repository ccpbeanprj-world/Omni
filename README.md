# OmniChat

OmniChat is a **single inbox** for customer messages from **LINE** and **WhatsApp**. You connect each platform with its API keys, then agents read and reply from one dashboard.

This is **not** a Claude chatbot. Customers talk to your LINE Official Account or WhatsApp number. Humans reply in OmniChat. **Facebook Messenger and WeChat are deferred** (known setup/dev issues); do not implement them unless the owner asks.

| Surface | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| Backend | http://localhost:3000 |
| Health | http://localhost:3000/api/health |

---

## What works today

| Piece | Status | Notes |
|-------|--------|--------|
| LINE Messaging API | Live | Webhook `/webhook/line`, send + receive |
| WhatsApp (Twilio) | Live | Webhook `/webhook/whatsapp`, send + receive |
| Unified dashboard | Live | React app, Socket.IO, conversation list + thread |
| Message history | Live | SQLite (`omni.db`) with JSON fallback |
| Facebook Messenger | Deferred | Adapter/docs exist; finish later. Do not wire until asked. |
| WeChat | Deferred | Same. Official Account verification is a common blocker. |
| Claude auto-reply | Off | Do not enable for this product |

---

## How a message flows (live path)

All production traffic goes through **`src/server.js`**. Do not treat `src/core/MessagePipeline.js` or `src/core/ServerManager.js` as the live webhook path.

```
LINE or WhatsApp user
    → POST /webhook/line  or  POST /webhook/whatsapp
    → save user + conversation + message (SQLite)
    → Socket.IO: new_message, message_received, user_message, …
    → Omni dashboard (omni-react-app)

Agent types a reply in the dashboard
    → POST /api/send-message-to-user
    → sendMessageToUser (LINE) or sendWhatsAppMessage (Twilio)
    → Socket.IO: new_message, message_sent
```

---

## Quick start

**Need:** Node.js 18+, npm, a LINE Messaging API channel, and a Twilio WhatsApp sandbox (or live WhatsApp number).

```bash
npm run setup
cp env.example .env
```

Edit `.env` with **your** keys (never commit `.env`):

```env
# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_WEBHOOK_URL=https://<your-public-host>/webhook/line

# WhatsApp (Twilio) — this is the live WhatsApp path
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_PHONE_NUMBER=+14155238886

# App
PORT=3000
NODE_ENV=development
JWT_SECRET=change_me_to_at_least_32_characters_______
```

```bash
npm run dev:all
```

That starts backend, frontend, and ngrok (for public webhooks). Or separately:

```bash
npm start                          # backend → :3000
cd omni-react-app && npm run dev   # dashboard → :5173
```

### LINE webhook

1. [LINE Developers Console](https://developers.line.biz/) → Messaging API channel  
2. Webhook URL: `https://<public-host>/webhook/line`  
3. Enable `message`, `postback`, `follow`, `unfollow`  
4. Paste Channel Access Token and Channel Secret into `.env`  
5. Send a message to the Official Account → it should appear in the dashboard  

### WhatsApp webhook (Twilio)

1. [Twilio Console](https://console.twilio.com/) → Account SID + Auth Token  
2. WhatsApp sandbox (or production sender)  
3. Inbound webhook: `https://<public-host>/webhook/whatsapp`  
4. Sandbox: send `join <code>` from your phone  
5. Reply from the dashboard to confirm both directions  

Compose and Docker must use `${LINE_CHANNEL_SECRET}` / `env_file: .env`. Do not paste real tokens into YAML or markdown.

---

## Project layout

```
Omni/
├── src/server.js              # LIVE entry: webhooks, APIs, Socket.IO, send
├── src/adapters/              # LineAdapter, TwilioWhatsAppAdapter, BaseAdapter
├── src/config/                # appConfig, secrets (redaction)
├── src/services/              # storage, cache, Twilio/LINE helpers
├── src/middleware/            # auth, CSRF, rate limit, webhook signatures
├── omni-react-app/            # Vite + React + Zustand dashboard
├── env.example                # placeholders only
├── CLAUDE.md                  # agent playbook
├── .cursor/rules/             # Cursor rules for additive changes
├── API.md                     # HTTP + Socket.IO reference
├── DEVELOPMENT.md             # how to change code safely
└── PLATFORM_INTEGRATION.md    # per-platform setup
```

Frontend: `omni-react-app/src/components/EnhancedLineStyleInterface.tsx` is the inbox UI. Send/load lives in `stores/chatStore.ts` — extend it, do not rewrite it.

---

## HTTP API (live)

Base: `http://localhost:3000`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Process + SQLite stats |
| GET | `/api/conversations` | List threads (`{ success, conversations }`) |
| GET | `/api/conversations/:id/messages` | History |
| POST | `/api/send-message-to-user` | Send (`conversationId`, `message`, `platform`) |
| POST | `/api/send-line-message` | LINE-only send |
| POST | `/api/send-whatsapp-message` | WhatsApp-only send |
| POST | `/webhook/line` | LINE inbound (raw body, signature) |
| POST | `/webhook/whatsapp` | Twilio inbound |

Details and JSON examples: [API.md](API.md).

---

## Socket.IO events (do not rename)

`new_message`, `user_message`, `real_user_message`, `whatsapp_message`, `line_message`, `message_sent`, `message_received`, `typing_start`, `typing_stop`.

Add new event names **next to** these. The dashboard already listens for the list above.

---

## Adding a new platform (Facebook, WeChat, …)

Keep LINE and WhatsApp working. Additive steps:

1. New file in `src/adapters/` extending `BaseAdapter`  
2. Register webhook **and** outbound send in **`src/server.js`** (the live path)  
3. Placeholder vars in `env.example` only  
4. Colors/icons in `omni-react-app/src/utils/platforms.ts` and `platformUtils.ts`  
5. Reuse `chatStore` — one inbox, isolated by `platform` on users/conversations  

Wiring **only** `src/routes/webhooks.js` or `MessagePipeline` will not put messages on the live dashboard. See `.cursor/rules/add-platform.mdc` and [DEVELOPMENT.md](DEVELOPMENT.md).

---

## Security (keys)

- Real secrets: `.env` only (gitignored, dockerignored)  
- Logs redact tokens / `sk-ant-` / `Bearer` via `src/config/secrets.js`  
- LINE webhooks: `X-Line-Signature`  
- WhatsApp/Twilio: signature when not in sandbox skip mode  
- Do not log `ENCRYPTION_KEY` or access tokens  

If an old `docker-compose.dev.yml` ever contained real LINE tokens, **rotate** those credentials in LINE Developers.

---

## More docs

| File | Use it for |
|------|------------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Commands, structure, debugging |
| [API.md](API.md) | Request/response shapes |
| [PLATFORM_INTEGRATION.md](PLATFORM_INTEGRATION.md) | LINE/WhatsApp setup detail |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Manual + automated tests |
| [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) | Auth, CSRF, rate limits |
| [CLAUDE.md](CLAUDE.md) | Rules for AI coding agents |
| [DOCS.md](DOCS.md) | Full document index |

Specialized (not live): [FACEBOOK_SETUP_中文指南.md](FACEBOOK_SETUP_中文指南.md), [FACEBOOK_ECOSYSTEM_INTEGRATION.md](FACEBOOK_ECOSYSTEM_INTEGRATION.md).

---

## Is this project perfect?

**No.** It is a working Omni inbox for LINE + WhatsApp, not a finished production platform.

**Solid:** bidirectional LINE and Twilio WhatsApp, one React inbox, real-time Socket.IO, SQLite persistence, webhook signatures, env-based secrets.

**Gaps:** `src/server.js` is a very large live file; `MessagePipeline` / `ServerManager` / some `src/routes` are unused duplicates; Facebook and WeChat are incomplete; tests are thin; SQLite does not replace PostgreSQL at scale; CSRF/auth behavior differs in development; older “86/100 production ready” write-ups overstate completeness.

Treat this README and `CLAUDE.md` as current. Older scorecards (`FINAL_ASSESSMENT.md`, `PROJECT_FINAL_EVALUATION.md`) are historical.

---

## License

MIT. See the repository license file if present.
