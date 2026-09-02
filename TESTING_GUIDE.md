# Omni-Channel Platform - Testing Guide

**Current:** LINE + WhatsApp Omni inbox. Start backend with `npm start`, dashboard with `cd omni-react-app && npm run dev` (or `npm run dev:all`). Health: `GET http://localhost:3000/api/health`. CSRF: inbox send routes (`/api/send-message-to-user`, `/api/send-line-message`, `/api/send-whatsapp-message`) are exempt in `src/server.js` — a 403 on those is not the expected “happy path” for the dashboard.

**Last aligned:** September 2026 · [README.md](README.md)

---

## 📋 Overview

This guide provides comprehensive testing instructions for the Omni-Channel Platform, including manual tests, automated tests, and security validation.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Running Omni server (`npm start`)
- LINE account (for LINE testing)
- WhatsApp number (for WhatsApp testing)

### Test Environment Setup
```bash
# Start the server
npm start

# The server should be running on:
# - Backend: http://localhost:3000
# - Frontend: http://localhost:5173
```

---

## 1️⃣ Manual Testing

### Health Check Test
```bash
# Test basic server health
curl http://localhost:3000/api/health

# Expected Response:
# {
#   "success": true,
#   "message": "Server is running",
#   "data": { ... }
# }
```

**Validation Criteria**:
- ✅ Returns 200 status
- ✅ Contains success: true
- ✅ Shows database stats
- ✅ Shows Socket.IO clients

---

### CSRF Protection Test

#### 1. Get CSRF Token
```bash
curl http://localhost:3000/api/csrf-token
```

**Expected Response**:
```json
{
  "success": true,
  "csrfToken": "your-csrf-token-here"
}
```

#### 2. Test Without Token (Should Fail)
```bash
curl -X POST http://localhost:3000/api/send-line-message \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"test","message":"test"}'
```

**Expected**: 403 Forbidden with CSRF error

#### 3. Test With Token (Should Pass)
```bash
# First get token
TOKEN=$(curl -s http://localhost:3000/api/csrf-token | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# Then use it
curl -X POST http://localhost:3000/api/send-line-message \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"conversationId":"conv_line_test","message":"Hello"}'
```

**Expected**: 200 OK with success response

---

### Webhook Signature Validation Test

#### LINE Webhook Test
```bash
# Test with invalid signature (should fail)
curl -X POST http://localhost:3000/webhook/line \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: invalid-signature" \
  -d '{"events":[{"type":"message"}]}'
```

**Expected**: 403 Forbidden

**Note**: Actual LINE webhooks from LINE servers will have valid signatures.

#### WhatsApp Webhook Test
```bash
# Test in development mode (should pass without validation)
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"MessageSid":"test","From":"whatsapp:+1234567890","Body":"Test"}'
```

**Expected**: 200 OK (in development mode)

**Note**: In production mode, signature validation is enforced.

---

### API Endpoint Tests

#### Get Conversations
```bash
curl http://localhost:3000/api/conversations
```

**Expected**: List of all conversations

#### Get Messages
```bash
curl "http://localhost:3000/api/conversations/CONV_ID/messages?limit=50"
```

**Replace `CONV_ID` with actual conversation ID**

**Expected**: List of messages for the conversation

---

### Socket.IO Connection Test

#### Connect to Socket.IO
```javascript
// In browser console or test script
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected!');
});

socket.on('new_message', (data) => {
  console.log('New message:', data);
});
```

**Expected**: Console logs show connection established

---

## 2️⃣ Security Tests

### JWT Authentication Test

#### Test Without Token
```bash
curl http://localhost:3000/api/conversations
```

**In Development**: Should work (optional auth)  
**In Production**: Should require authentication

#### Test With Token
```bash
# Get a valid JWT token (implementation specific)
curl http://localhost:3000/api/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: 200 OK with conversations

---

### Rate Limiting Test

```bash
# Make multiple rapid requests
for i in {1..10}; do
  curl http://localhost:3000/api/conversations
done
```

**Expected**: After 100 requests in 15 minutes, should get rate limited

**Note**: Exact limits configured in `src/middleware/rateLimiter.js`

---

### Input Validation Test

#### Test with Malicious Input
```bash
curl -X POST http://localhost:3000/api/send-line-message \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: test" \
  -d '{"conversationId":"<script>alert(1)</script>","message":"test"}'
```

**Expected**: Input sanitized, no XSS

---

## 3️⃣ Integration Tests

### LINE Integration Test

1. **Send message to your LINE bot**
2. **Check server logs for**:
   - ✅ Webhook received
   - ✅ Signature validated
   - ✅ Message processed
   - ✅ Real-time event emitted

3. **Verify in frontend**:
   - Message appears in chat
   - User profile loads correctly
   - Real-time updates work

---

### WhatsApp Integration Test

1. **Send message to WhatsApp number**
2. **Check server logs for**:
   - ✅ Webhook received
   - ✅ Message processed
   - ✅ User created/found
   - ✅ Conversation created/found

3. **Reply from frontend**:
   - Type message in frontend
   - Click send
   - Verify message delivered to WhatsApp user

---

### Real-Time Messaging Test

1. **Open two browser windows**
2. **Send message from window 1**
3. **Verify in window 2**:
   - ✅ Message appears instantly
   - ✅ Shows in real-time
   - ✅ UI updates without refresh

---

## 4️⃣ Performance Tests

### Message Processing Speed
```bash
# Send 10 messages rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3000/webhook/line \
    -H "Content-Type: application/json" \
    -d "{\"events\":[{\"type\":\"message\",\"message\":{\"text\":\"Test $i\"}}]}"
done
```

**Expected**: All messages processed within 2 seconds

---

### Concurrent Users
```bash
# Simulate 10 concurrent users
for i in {1..10}; do
  curl http://localhost:3000/api/conversations &
done
```

**Expected**: All requests complete successfully

---

## 5️⃣ Error Handling Tests

### Database Error Test
```bash
# Stop server, make request
curl http://localhost:3000/api/conversations
```

**Expected**: Graceful error handling (not crash)

---

### Invalid Request Test
```bash
curl -X POST http://localhost:3000/api/send-line-message \
  -d 'invalid-json'
```

**Expected**: 400 Bad Request with clear error message

---

## 6️⃣ Security Checklist

### ✅ Completed Security Features
- ✅ JWT authentication
- ✅ Webhook signature validation (LINE, WhatsApp)
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Input validation
- ✅ XSS protection
- ✅ SQL injection prevention
- ✅ Audit logging
- ✅ Security headers (Helmet)
- ✅ Socket.IO authentication

### 🧪 Test Each Feature
```bash
# Run security tests
npm test

# Or run specific test suite
npm test -- tests/security.test.js
```

---

## 7️⃣ Automated Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- tests/security.test.js
npm test -- tests/integration/webhook.test.js
```

### Test Coverage
```bash
npm test -- --coverage
```

**Target**: 80%+ coverage

---

## 8️⃣ Load Testing

### Using Apache Bench
```bash
# Install if needed: brew install httpd (Mac) or apt-get install apache2-utils (Linux)

# Test 1000 requests with 10 concurrent
ab -n 1000 -c 10 http://localhost:3000/api/health
```

**Expected**: All requests complete, no errors

---

## 9️⃣ Monitoring Tests

### Check Log Files
```bash
# View recent logs
tail -f logs/app-2025-10-27.log
tail -f logs/combined-2025-10-27.log
tail -f logs/error-2025-10-27.log
```

### Check Audit Logs
```bash
tail -f logs/audit/audit-2025-10-27.log
```

**Verify**: Security events logged properly

---

## 🔍 Common Issues & Solutions

### Issue: CSRF Token Rejected
**Solution**: Make sure you fetch a fresh token before each request

### Issue: Webhook Signature Failed
**Solution**: 
- Check LINE_CHANNEL_SECRET is set correctly
- For WhatsApp, ensure environment variable is set
- In development, use `SKIP_WEBHOOK_SIGNATURE=true`

### Issue: Rate Limited
**Solution**: Wait for rate limit window to reset (15 minutes)

### Issue: Socket.IO Not Connecting
**Solution**: 
- Check CORS settings
- Verify Socket.IO URL is correct
- Check browser console for errors

---

## ✅ Test Results Checklist

### Basic Functionality
- [ ] Server starts successfully
- [ ] Health check returns 200
- [ ] CSRF protection works
- [ ] Webhooks receive messages
- [ ] Messages process correctly
- [ ] Real-time updates work

### Security
- [ ] JWT authentication enforced
- [ ] Webhook signatures validated
- [ ] CSRF tokens required
- [ ] Rate limiting active
- [ ] Input validation works
- [ ] Error logging proper

### Performance
- [ ] Response time < 200ms (average)
- [ ] Handles 100+ concurrent requests
- [ ] No memory leaks
- [ ] Database queries optimized

---

## 📊 Success Criteria

**All tests pass** when:
- ✅ No errors in logs
- ✅ All API endpoints respond correctly
- ✅ Webhooks process messages
- ✅ Real-time updates work
- ✅ Security features function
- ✅ Performance meets targets

---

## 🆘 Support

If tests fail, check:
1. Server logs: `logs/` directory
2. Database: SQLite file exists and is accessible
3. Environment variables: `.env` file configured
4. Port availability: No conflicts on port 3000

For issues, see `README.md` troubleshooting section.


