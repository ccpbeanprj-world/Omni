# Interview guide — OmniChat

**Short answer:** This project is **not perfect**. It **is** usable for an interview if you demo LINE + WhatsApp honestly and can explain tradeoffs. Do not claim “production-ready omni-channel for four platforms.”

---

## 1. What to say it is

> I built a unified agent inbox. LINE and WhatsApp customers message official accounts. Webhooks land in one Node server, messages are stored, and a React dashboard updates over Socket.IO. Agents reply through one API that routes back to LINE or Twilio.

**Elevator (30 seconds)**

- Problem: support teams jump between LINE OA and WhatsApp.
- Solution: one thread list, one composer, platform isolation (`platform` on user/conversation).
- Live stack: Node/Express + SQLite + Socket.IO + React/Zustand/Vite.
- Integrations: LINE Messaging API, Twilio WhatsApp.
- Deferred: Facebook Messenger, WeChat (account/verification friction).

**Not this project:** an AI that auto-replies as Claude. Agents are human.

---

## 2. What is actually live (memorize)

| You can demo | You must not claim as done |
|--------------|----------------------------|
| `POST /webhook/line` receive + dashboard | Facebook Messenger live |
| `POST /webhook/whatsapp` (Twilio) | WeChat live |
| `POST /api/send-message-to-user` | High test coverage / CI |
| Socket.IO `new_message` / `message_sent` | Microservice mesh in production |
| SQLite history | PostgreSQL as the running default |

**Live code path:** `src/server.js` (webhooks, store, emit, send).  
**Not live:** `src/core/MessagePipeline.js`, `src/core/ServerManager.js`. If asked “why two architectures?” say: earlier modular design was started; production traffic stayed on `server.js`; you would finish the split later, not swap paths mid-demo.

---

## 3. 8-minute demo script

**Before the call**

1. `.env` has LINE + Twilio keys (never show the file on camera).
2. `npm start` and `cd omni-react-app && npm run dev` (or `npm run dev:all` + ngrok).
3. Confirm `GET http://localhost:3000/api/health` → `success: true`.
4. Open http://localhost:5173 — at least one conversation if you have sandbox history.
5. Phone with LINE and/or WhatsApp sandbox ready.

**On camera**

1. **Health** — curl or browser `/api/health`. “Process is up, SQLite has N conversations.”
2. **Inbound** — send a LINE (or WhatsApp) message. Dashboard should show it without refresh (Socket.IO).
3. **Outbound** — type a reply in Omni, send. Phone receives it.
4. **Isolation** — point at `platform: line` vs `whatsapp` on conversations. Same UI, separate identities.
5. **Code jump (2 min)** — `src/server.js` webhook → `saveMessage` → `io.emit('new_message')` → `sendMessageToUser` / `sendWhatsAppMessage`. Frontend: `chatStore` + `EnhancedLineStyleInterface`.
6. **Close** — “Facebook/WeChat later. Next I’d split `server.js` and add webhook integration tests.”

If ngrok/webhook fails in the interview, fall back: show existing threads + send API + walk the code. Say “webhook needs a public URL; locally we use ngrok.”

---

## 4. Likely questions and honest answers

**Why adapters?**  
Each vendor has different auth, signatures, and payloads. `BaseAdapter` defines `sendMessage` / `validateWebhook` / `getProfile`. LINE and Twilio implement them. New channel = new adapter + hook in `server.js`, same dashboard.

**How do you verify webhooks?**  
LINE: `X-Line-Signature` (HMAC). Twilio: request signature; sandbox may skip in development. Never trust a raw webhook body without that in production.

**How does the UI stay realtime?**  
After persist, the server emits Socket.IO events. The React store appends the message. HTTP is for history and send; socket is for push.

**Why SQLite?**  
Fast local demo and single-process. For multi-instance production you would move to PostgreSQL and a real queue (RabbitMQ is already a fallback idea, not required for the demo).

**Security?**  
Keys in `.env` only. Logs redact tokens. Helmet, rate limits, XSS sanitization, optional JWT. CSRF is skipped on the inbox send routes so the dashboard can post. You would tighten auth for a real deploy.

**Why is `server.js` so large?**  
Honest debt. It is the working orchestrator. You would extract webhook routers and send services without changing event names or URLs.

**Facebook/WeChat?**  
Deferred: Meta Business verification and WeChat Official Account approval blocked you. Design is ready (`add-platform` checklist); you did not ship a half-wired channel.

**Tests?**  
Some Jest security unit tests. You would add webhook + send integration tests next. Do not say “80% coverage.”

---

## 5. How to put it on a resume / GitHub

**Title:** Omni-channel inbox (LINE + WhatsApp) — Node, Socket.IO, React  

**Bullets (true)**

- Bidirectional messaging: LINE Messaging API and Twilio WhatsApp via signed webhooks.
- Unified agent UI (React/Zustand) with Socket.IO live updates.
- Platform-isolated conversations; one send API routes by `platform`.
- Secrets via env; no keys in repo (use `env.example`).

**Do not write**

- “Facebook, WeChat, Instagram fully integrated.”
- “Production-ready / 88/100.”
- “AI chatbot” / Claude auto-reply as a feature.

**GitHub hygiene before push**

- No `.env`, no `omni.db` if it has real chats, no `.cursor/` (ignored).
- Keep `CLAUDE.md` + `README.md` + `env.example`.
- Search history for old LINE tokens in compose files; rotate if they were ever committed.

---

## 6. What interviewers will like vs poke

**Like:** real vendor APIs, webhooks, realtime UI, clear “what’s live,” adapter thinking, you know the debt.

**Poke:** god-file `server.js`, unused modules, thin tests, SQLite, CSRF exceptions, duplicate event emits, Facebook docs vs reality.

Your strongest move is naming those pokes **first**. That reads as senior, not defensive.

---

## 7. Day-before checklist

- [ ] Demo inbound + outbound once on your network  
- [ ] Health 200  
- [ ] README “What works today” table memorized  
- [ ] One improvement story: “split server.js + webhook tests”  
- [ ] Repo has no secrets  
- [ ] 30-second pitch out loud  

If only one channel works that day, demo that one and say the other is the same pattern.
