# Documentation index

Start here: **[README.md](README.md)** (product, setup, live path, honest status).

## Current (keep in sync with `src/server.js`)

| Document | Audience |
|----------|----------|
| [README.md](README.md) | Operators and developers — Omni LINE + WhatsApp inbox |
| [INTERVIEW.md](INTERVIEW.md) | How to demo and talk about this repo in interviews |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Changing code without breaking chat |
| [API.md](API.md) | HTTP and Socket.IO contracts |
| [PLATFORM_INTEGRATION.md](PLATFORM_INTEGRATION.md) | LINE / WhatsApp (Twilio) setup |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Manual checks and `npm test` |
| [tests/README.md](tests/README.md) | Jest unit tests |
| [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) | Auth, CSRF, webhooks, encryption |
| [CLAUDE.md](CLAUDE.md) | Cursor/Claude agent playbook |
| [env.example](env.example) | Placeholder environment variables |

## Cursor (additive changes)

`.cursor/rules/` — `omni-core.mdc`, `backend-adapters.mdc`, `frontend-react.mdc`, `api-socket-contracts.mdc`, `add-platform.mdc`, `env-secrets.mdc`.

## Not live / historical

These are useful for Facebook later or as old reviews. They are **not** the live architecture:

- [FACEBOOK_SETUP_中文指南.md](FACEBOOK_SETUP_中文指南.md)
- [FACEBOOK_ECOSYSTEM_INTEGRATION.md](FACEBOOK_ECOSYSTEM_INTEGRATION.md)
- [FACEBOOK_SMS_ISSUE_SOLUTIONS.md](FACEBOOK_SMS_ISSUE_SOLUTIONS.md)
- [INTEGRATION_COMPARISON.md](INTEGRATION_COMPARISON.md)
- [NEXT_PHASE_ROADMAP.md](NEXT_PHASE_ROADMAP.md)
- [FINAL_ASSESSMENT.md](FINAL_ASSESSMENT.md)
- [PROJECT_FINAL_EVALUATION.md](PROJECT_FINAL_EVALUATION.md)

Live webhooks and send APIs live in `src/server.js`, not in `src/core/MessagePipeline.js`.
