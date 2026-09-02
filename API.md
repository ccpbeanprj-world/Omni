# OmniChat Platform - API Documentation

> **Live server:** `src/server.js` on `http://localhost:3000`. Dashboard: `http://localhost:5173`. Auth on `/api/*` is **optional** in development (`optionalAuth`) unless you set production JWT. Send endpoints used by the inbox skip CSRF (see `setupMiddleware` in `server.js`). Full product context: [README.md](README.md).

## Base URL
```
http://localhost:3000/api
```

## Authentication
The API supports JWT-based authentication with comprehensive security features:
- **JWT Tokens**: Secure token-based authentication
- **Rate Limiting**: Multi-tier rate limiting for different endpoints
- **Input Validation**: XSS protection and SQL injection prevention
- **Webhook Security**: HMAC-SHA256 signature verification

## Endpoints

### Health Check

#### GET /health
Check the health status of the server and connected services.

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "data": {
    "database": "SQLite",
    "platforms": ["line", "whatsapp", "telegram"],
    "messageQueue": "RabbitMQ",
    "socketClients": 1,
    "users": 1,
    "conversations": 1,
    "messages": 25
  }
}
```

### Conversations

#### GET /conversations
Get all conversations.

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
      "user_id": "user_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
      "platform": "line",
      "platform_conversation_id": "Ud78c6c9edac7c2f989046cf4fccbcff8",
      "platform_user_id": "Ud78c6c9edac7c2f989046cf4fccbcff8",
      "status": "active",
      "user_name": "Bean Chan",
      "profile_picture_url": "https://sprofile.line-scdn.net/...",
      "business_account_name": "Omni Business Account",
      "last_message": "Hello from LINE user",
      "last_message_at": "2025-10-22T15:30:00.000Z",
      "message_count": 25,
      "created_at": "2025-10-22T14:44:15.841Z",
      "updated_at": "2025-10-22T15:30:00.000Z"
    }
  ]
}
```

#### GET /conversations/:id/messages
Get messages for a specific conversation.

**Parameters:**
- `id` (string): Conversation ID
- `limit` (number, optional): Number of messages to return (default: 100)
- `offset` (number, optional): Number of messages to skip (default: 0)
- `order` (string, optional): Sort order - "ASC" or "DESC" (default: "ASC")

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg_1761145843014_6magp1h86",
      "conversation_id": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
      "sender_id": "user_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
      "sender_name": "Bean Chan",
      "sender_type": "user",
      "message_type": "text",
      "content": "Hello from LINE user",
      "platform": "line",
      "platform_message_id": "584374826328653946",
      "status": "received",
      "created_at": "2025-10-22T15:30:00.000Z",
      "updated_at": "2025-10-22T15:30:00.000Z"
    }
  ],
  "total": 25,
  "hasMore": false
}
```

### Messages

#### POST /send-message-to-user
Send a message to a user (platform-aware endpoint).

**Request Body:**
```json
{
  "conversationId": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
  "message": "Hello from OmniChat platform",
  "platform": "line"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "msg_1761145843014_6magp1h86",
    "conversationId": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
    "platform": "line",
    "status": "sent"
  }
}
```

#### POST /send-whatsapp-message
Send a WhatsApp message specifically via Twilio.

**Request Body:**
```json
{
  "conversationId": "conv_whatsapp_+1234567890",
  "message": "Hello from OmniChat WhatsApp!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp message sent successfully",
  "data": {
    "messageId": "msg_whatsapp_1761145843014",
    "conversationId": "conv_whatsapp_+1234567890",
    "platform": "whatsapp",
    "twilioSid": "SM1234567890abcdef",
    "status": "sent"
  }
}
```

#### POST /send-line-message
Send a LINE message specifically.

**Request Body:**
```json
{
  "conversationId": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
  "message": "Hello from OmniChat LINE!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "LINE message sent successfully",
  "data": {
    "messageId": "msg_line_1761145843014",
    "conversationId": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
    "platform": "line",
    "lineMessageId": "584374826328653946",
    "status": "sent"
  }
}
```

#### POST /store-user-message
Store a user message (for testing purposes).

**Request Body:**
```json
{
  "conversationId": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
  "content": "Test message from user",
  "senderId": "user_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
  "senderName": "Bean Chan"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message stored successfully",
  "data": {
    "messageId": "msg_1761145843014_6magp1h86"
  }
}
```

#### POST /sync-message-history
Sync message history for a conversation.

**Request Body:**
```json
{
  "conversationId": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
  "messages": [
    {
      "sender_id": "user_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
      "sender_name": "Bean Chan",
      "sender_type": "user",
      "message_type": "text",
      "content": "Historical message",
      "platform": "line",
      "platform_message_id": "line_msg_history_1",
      "status": "received",
      "created_at": "2025-10-15T10:30:00.000Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message history sync completed",
  "data": {
    "conversationId": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
    "totalMessages": 1,
    "syncedCount": 1,
    "skippedCount": 0
  }
}
```

### Users

#### GET /users
Get all users.

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "user_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
      "platform_id": "Ud78c6c9edac7c2f989046cf4fccbcff8",
      "platform": "line",
      "name": "Bean Chan",
      "display_name": null,
      "profile_picture_url": "https://sprofile.line-scdn.net/...",
      "status": "active",
      "created_at": "2025-10-22T14:44:15.689Z",
      "updated_at": "2025-10-22T14:44:15.689Z"
    }
  ]
}
```

#### GET /users/:id
Get a specific user by ID.

**Parameters:**
- `id` (string): User ID

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
    "platform_id": "Ud78c6c9edac7c2f989046cf4fccbcff8",
    "platform": "line",
    "name": "Bean Chan",
    "display_name": null,
    "profile_picture_url": "https://sprofile.line-scdn.net/...",
    "status": "active",
    "created_at": "2025-10-22T14:44:15.689Z",
    "updated_at": "2025-10-22T14:44:15.689Z"
  }
}
```

## Webhook Endpoints

### LINE Webhook

#### POST /webhook/line
Receive LINE webhook events.

**Request Body:**
```json
{
  "destination": "U51a9576fc63f807212bbd80f5209115e",
  "events": [
    {
      "type": "message",
      "message": {
        "type": "text",
        "id": "584374826328653946",
        "text": "Hello from LINE"
      },
      "source": {
        "type": "user",
        "userId": "Ud78c6c9edac7c2f989046cf4fccbcff8"
      },
      "replyToken": "reply_token_123",
      "timestamp": 1761145843435
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

### WhatsApp Webhook (Twilio)

#### POST /webhook/whatsapp
Receive WhatsApp webhook events from Twilio.

**Request Body:**
```json
{
  "MessageSid": "SM1234567890abcdef",
  "From": "whatsapp:+1234567890",
  "To": "whatsapp:+14155238886",
  "Body": "Hello from WhatsApp!",
  "MessageStatus": "received",
  "AccountSid": "AC1234567890abcdef",
  "ApiVersion": "2010-04-01",
  "Direction": "inbound"
}
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp webhook processed successfully"
}
```

#### GET /webhook/whatsapp
Webhook verification for Twilio WhatsApp sandbox.

**Query Parameters:**
- `hub.mode` - Should be "subscribe"
- `hub.verify_token` - Verification token
- `hub.challenge` - Challenge string

**Response:**
Returns the challenge string if verification is successful.

## Socket.IO Events

### Client → Server Events

#### join_conversation
Join a conversation room for real-time updates.

```javascript
socket.emit('join_conversation', { conversationId: 'conv_line_123' });
```

#### leave_conversation
Leave a conversation room.

```javascript
socket.emit('leave_conversation', { conversationId: 'conv_line_123' });
```

#### typing_start
Indicate user started typing.

```javascript
socket.emit('typing_start', { 
  conversationId: 'conv_line_123',
  userId: 'user_line_123' 
});
```

#### typing_stop
Indicate user stopped typing.

```javascript
socket.emit('typing_stop', { 
  conversationId: 'conv_line_123',
  userId: 'user_line_123' 
});
```

#### mark_message_read
Mark a message as read.

```javascript
socket.emit('mark_message_read', { 
  messageId: 'msg_123',
  userId: 'user_line_123' 
});
```

### Server → Client Events

#### new_message
New message received.

```javascript
socket.on('new_message', (data) => {
  console.log('New message:', data);
});
```

**Event Data:**
```json
{
  "id": "msg_1761145843014_6magp1h86",
  "conversation_id": "conv_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
  "sender_id": "user_line_Ud78c6c9edac7c2f989046cf4fccbcff8",
  "sender_name": "Bean Chan",
  "sender_type": "user",
  "message_type": "text",
  "content": "Hello from LINE user",
  "platform": "line",
  "platform_message_id": "584374826328653946",
  "status": "received",
  "created_at": "2025-10-22T15:30:00.000Z",
  "timestamp": "2025-10-22T15:30:00.000Z"
}
```

#### user_message
User message event.

```javascript
socket.on('user_message', (data) => {
  console.log('User message:', data);
});
```

#### real_user_message
Real user message event.

```javascript
socket.on('real_user_message', (data) => {
  console.log('Real user message:', data);
});
```

#### message_sent
Message sent confirmation.

```javascript
socket.on('message_sent', (data) => {
  console.log('Message sent:', data);
});
```

#### message_received
Message received confirmation.

```javascript
socket.on('message_received', (data) => {
  console.log('Message received:', data);
});
```

#### universal_message
Universal message event (platform-agnostic).

```javascript
socket.on('universal_message', (data) => {
  console.log('Universal message:', data);
});
```

#### whatsapp_message
WhatsApp-specific message event.

```javascript
socket.on('whatsapp_message', (data) => {
  console.log('WhatsApp message:', data);
});
```

#### line_message
LINE-specific message event.

```javascript
socket.on('line_message', (data) => {
  console.log('LINE message:', data);
});
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Messages per second**: 10
- **Requests per minute**: 1000
- **Webhook events**: No limit (but validation required)

## Webhook Security

All webhook endpoints validate signatures:

### LINE Webhook
- Validates `X-Line-Signature` header
- Uses HMAC-SHA256 with channel secret

### WhatsApp Webhook (Twilio)
- Validates Twilio signature
- Uses HMAC-SHA256 with auth token
- Supports sandbox verification

### Facebook Messenger Webhook
- Validates `X-Hub-Signature-256` header
- Uses HMAC-SHA256 with app secret

### WeChat Webhook
- Validates signature parameter
- Uses SHA1 with token

## Examples

### Complete Message Flow

1. **Receive message from LINE user**
   ```bash
   curl -X POST http://localhost:3000/webhook/line \
     -H "Content-Type: application/json" \
     -H "X-Line-Signature: your_signature" \
     -d '{"events":[{"type":"message","message":{"type":"text","text":"Hello"},"source":{"userId":"user123"}}]}'
   ```

2. **Send message to LINE user**
   ```bash
   curl -X POST http://localhost:3000/api/send-line-message \
     -H "Content-Type: application/json" \
     -d '{"conversationId":"conv_line_123","message":"Hello back!"}'
   ```

3. **Receive message from WhatsApp user**
   ```bash
   curl -X POST http://localhost:3000/webhook/whatsapp \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d 'MessageSid=SM123&From=whatsapp:+1234567890&To=whatsapp:+14155238886&Body=Hello%20WhatsApp!'
   ```

4. **Send message to WhatsApp user**
   ```bash
   curl -X POST http://localhost:3000/api/send-whatsapp-message \
     -H "Content-Type: application/json" \
     -d '{"conversationId":"conv_whatsapp_+1234567890","message":"Hello back from WhatsApp!"}'
   ```

5. **Get conversation messages**
   ```bash
   curl http://localhost:3000/api/conversations/conv_line_123/messages
   ```

### Socket.IO Client Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Connect
socket.on('connect', () => {
  console.log('Connected to server');
});

// Join conversation
socket.emit('join_conversation', { 
  conversationId: 'conv_line_123' 
});

// Listen for messages
socket.on('new_message', (data) => {
  console.log('New message:', data);
  // Update UI with new message
});

// Listen for platform-specific messages
socket.on('whatsapp_message', (data) => {
  console.log('WhatsApp message:', data);
});

socket.on('line_message', (data) => {
  console.log('LINE message:', data);
});

// Send typing indicator
socket.emit('typing_start', { 
  conversationId: 'conv_line_123',
  userId: 'user_line_123' 
});
```

---

**API Version**: 1.0  
**Last Updated**: 2025-10-22

