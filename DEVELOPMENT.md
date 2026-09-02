# OmniChat Platform - Development Guide

> **Current truth (2026):** Live chat is `src/server.js` + `omni-react-app`. LINE and WhatsApp (Twilio) are the product. Do not route new webhooks only through `src/core/MessagePipeline.js` or `src/core/ServerManager.js`. Full setup: [README.md](README.md). Index: [DOCS.md](DOCS.md).

## Architecture (live vs unused)

**Live**

1. Platform adapters (`src/adapters/`) called from `src/server.js`
2. Webhooks and send APIs on `src/server.js`
3. SQLite via `legacyDataStorageService` / `omni.db`
4. Socket.IO on the same HTTP server
5. Dashboard: Zustand `chatStore` + Socket.IO client

**Present but not the live webhook path:** `MessagePipeline.js`, `ServerManager.js`, much of `src/routes/webhooks.js`. You may read them; do not “fix” production by switching LINE/WhatsApp onto them.

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- npm/yarn
- Git
- LINE Developer Account (for LINE integration)
- Twilio Account (for WhatsApp integration)

### Local Development

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd OmniChat
   npm install
   cd omni-react-app && npm install && cd ..
   ```

2. **Environment configuration**
   ```bash
   cp env.example .env
   # Edit .env with your LINE and Twilio credentials
   ```

3. **Start development servers**
   ```bash
   npm run dev:all
   ```

### Development Commands

```bash
# Backend only
npm start

# Frontend only  
cd omni-react-app && npm run dev

# Both together
npm run dev:all

# Database operations
npm run db:migrate
npm run db:seed

# Testing
npm test
npm run test:integration
```

## 📁 Code Structure

### Backend (`src/`)

```
src/
├── adapters/           # Platform-specific integrations
│   ├── BaseAdapter.js  # Abstract base adapter
│   ├── LineAdapter.js  # LINE integration
│   └── ...            # Other platform adapters
├── config/            # Configuration management
│   ├── appConfig.js   # Main configuration
│   ├── database.js    # Database configuration
│   └── security.js    # Security settings
├── core/              # Core business logic
│   ├── MessagePipeline.js    # Message processing
│   ├── RealtimeManager.js    # Real-time handling
│   └── ServerManager.js      # Server management
├── services/          # Business services
│   ├── databaseService.js      # Database operations
│   ├── platformManager.js      # Platform management
│   ├── userManagementService.js # User operations
│   └── universalRealtimeService.js # Real-time events
├── middleware/        # Express middleware
├── routes/           # API routes
└── server.js         # Main entry point
```

### Frontend (`omni-react-app/src/`)

```
src/
├── components/        # React components
│   ├── ChatInterface.tsx
│   ├── ConversationList.tsx
│   └── MessageInput.tsx
├── services/         # API and Socket.IO services
│   ├── api.ts        # REST API client
│   └── socketService.ts # Socket.IO client
├── stores/           # Zustand state management
│   └── chatStore.ts  # Main chat state
├── types/            # TypeScript definitions
└── utils/            # Utility functions
```

## 🔌 Platform Integration

### Adding a New Platform

Keep LINE and WhatsApp handlers in `src/server.js` unchanged. Additive:

1. **Adapter** — `src/adapters/NewPlatformAdapter.js` extending `BaseAdapter` (`sendMessage`, `validateWebhook`, `getProfile`, …).
2. **Live webhook + send** — register `POST /webhook/newplatform` and outbound send **in `src/server.js`**, same pattern as LINE: save message, emit `new_message`, return 200 even if extra work fails.
3. **Env** — placeholders in `env.example` only (`NEWPLATFORM_*`).
4. **UI** — `omni-react-app/src/utils/platforms.ts` and `platformUtils.ts`. Reuse `chatStore`; do not add a second inbox.
5. Optional copies in `platformManager.js` / `src/routes/webhooks.js` are **not** enough by themselves.

See `.cursor/rules/add-platform.mdc`.

### WhatsApp Development Setup (Twilio)

1. **Twilio Account Setup**
   ```bash
   # Get credentials from Twilio Console
   TWILIO_ACCOUNT_SID=AC1234567890abcdef
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_PHONE_NUMBER=+14155238886
   ```

2. **WhatsApp Sandbox Configuration**
   - Use Twilio's WhatsApp sandbox for development
   - Sandbox number: `+14155238886`
   - Send "join <sandbox-code>" to activate
   - Configure webhook URL: `https://yourdomain.com/webhook/whatsapp`

3. **Testing WhatsApp Integration**
   ```bash
   # Test webhook verification
   curl "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=any_token&hub.challenge=test123"
   
   # Test message sending
   curl -X POST http://localhost:3000/api/send-whatsapp-message \
     -H "Content-Type: application/json" \
     -d '{"conversationId":"conv_whatsapp_+1234567890","message":"Test message"}'
   ```

### Platform Configuration

Each platform requires specific configuration:

```javascript
const platformConfig = {
  webhookPath: '/webhook/platform',
  apiBaseUrl: 'https://api.platform.com/v1',
  accessToken: process.env.PLATFORM_ACCESS_TOKEN,
  messageTypes: ['text', 'image', 'file'],
  rateLimits: {
    messagesPerSecond: 10,
    requestsPerMinute: 1000
  }
};
```

## 🗄️ Database Schema

### Core Tables

```sql
-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  platform_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  profile_picture_url TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE conversations (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  platform_conversation_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  user_name VARCHAR(255),
  profile_picture_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
  id VARCHAR(255) PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  sender_id VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255),
  sender_type VARCHAR(50) NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  content TEXT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  platform_message_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔄 Real-time Communication

### Socket.IO Events

The system uses Socket.IO for real-time communication:

```javascript
// Server-side event emission
io.emit('new_message', {
  id: messageId,
  conversation_id: conversationId,
  sender_id: senderId,
  sender_name: senderName,
  content: messageContent,
  timestamp: new Date().toISOString()
});

// Client-side event handling
socketService.on('new_message', (data) => {
  chatStore.addMessage(data);
});
```

### Event Types

- `new_message` - New message received
- `user_message` - User message event
- `real_user_message` - Real user message
- `message_sent` - Message sent confirmation
- `message_received` - Message received confirmation
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `user_online` - User came online
- `user_offline` - User went offline

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing

1. **Health Check**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Socket.IO Connection**
   ```bash
   # Open browser console and check for:
   # "✅ SocketService: Connected successfully"
   ```

3. **Message Flow**
   - Send message from LINE app
   - Check OmniChat dashboard for real-time display
   - Send message from OmniChat to LINE user

## 🚀 Deployment

### Docker Deployment

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose up -d
```

### Manual Deployment

1. **Build frontend**
   ```bash
   cd omni-react-app
   npm run build
   ```

2. **Start production server**
   ```bash
   NODE_ENV=production npm start
   ```

### Environment Variables

Required environment variables:

```env
# Server
PORT=3000
NODE_ENV=production

# LINE Integration
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret

# WhatsApp (Twilio) — live path
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_PHONE_NUMBER=+14155238886

# Database
DATABASE_URL=sqlite:./omni.db

# Socket.IO
SOCKET_URL=http://localhost:3000
```

## 🔍 Debugging

### Common Issues

1. **Socket.IO Connection Issues**
   - Check CORS configuration
   - Verify Socket.IO URL
   - Check browser console for errors

2. **Message Not Displaying**
   - Check webhook configuration
   - Verify LINE channel settings
   - Check database connection

3. **WhatsApp Integration Issues**
   - Verify Twilio credentials in `.env`
   - Check webhook URL configuration in Twilio Console
   - Ensure ngrok tunnel is running for local development
   - Verify WhatsApp sandbox activation

4. **Performance Issues**
   - Monitor database queries
   - Check message queue status
   - Review Socket.IO connection count

### Logging

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only
- `app-YYYY-MM-DD.log` - Daily logs

## 📈 Performance Optimization

### Database Optimization
- Use indexes on frequently queried columns
- Implement connection pooling
- Consider read replicas for high traffic

### Socket.IO Optimization
- Use Redis adapter for multiple server instances
- Implement connection limits
- Monitor connection count

### Caching
- Profile picture caching
- User data caching
- Message history caching

## 🔒 Security

### Best Practices
- Validate all webhook signatures
- Sanitize user input
- Use HTTPS in production
- Implement rate limiting
- Regular security updates

### Environment Security
- Never commit `.env` files
- Use environment-specific configurations
- Implement proper access controls
- Regular security audits

---

**Happy coding! 🚀**

