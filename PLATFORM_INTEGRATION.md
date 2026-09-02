# 🔌 Platform Integration Guide

> **Live (2026):** LINE Messaging API and WhatsApp via **Twilio** are wired in `src/server.js`. Facebook Messenger and WeChat adapters exist but are **not** on that path. Product is one Omni dashboard; agents reply (no Claude customer auto-reply). See [README.md](README.md).

## **Multi-Platform Chat Management System**

This guide covers the complete integration of multiple chat platforms into the OmniChat system, including LINE, WhatsApp (Twilio), Facebook Messenger, and WeChat.

---

## **📊 Platform Status Overview**

| Platform | Status | Implementation | Features |
|----------|--------|----------------|----------|
| **LINE** | Live | `src/server.js` + LINE Messaging API | Text inbound/outbound (stickers/media vary) |
| **WhatsApp** | Live | Twilio WhatsApp in `src/server.js` | Text inbound/outbound |
| **Facebook Messenger** | Not live | Adapter + docs only | Do not claim dashboard support until webhook+send are in `server.js` |
| **WeChat** | Not live | Adapter + docs only | Same |

---

## **🏗️ Architecture Overview**

### **Platform Adapter Pattern**

The system uses a unified adapter pattern for seamless platform integration:

```javascript
// Base Adapter Structure
class BaseAdapter {
  constructor(platform, config) {
    this.platform = platform;
    this.config = config;
  }
  
  async sendMessage(userId, message) {
    throw new Error('sendMessage must be implemented');
  }
  
  async handleWebhook(payload) {
    throw new Error('handleWebhook must be implemented');
  }
  
  async getUserProfile(userId) {
    throw new Error('getUserProfile must be implemented');
  }
}
```

### **Message Flow Architecture (live)**

```
[LINE / WhatsApp user]
    → POST /webhook/line or /webhook/whatsapp
    → src/server.js (validate, store SQLite, emit Socket.IO)
    → Omni dashboard

[Agent in dashboard]
    → POST /api/send-message-to-user
    → sendMessageToUser / sendWhatsAppMessage
    → LINE or Twilio API
```

`MessagePipeline` in older diagrams is **not** what production webhooks call today.

---

## **✅ LINE Integration (Complete)**

### **Setup Requirements**

1. **LINE Developer Account**
   - Create provider and channel at [LINE Developers Console](https://developers.line.biz/)
   - Select "Messaging API" channel type
   - Get Channel Access Token and Channel Secret

2. **Environment Configuration**
   ```env
   LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
   LINE_CHANNEL_SECRET=your_line_channel_secret
   ```

3. **Webhook Configuration**
   - Webhook URL: `https://yourdomain.com/webhook/line`
   - Enable events: `message`, `postback`, `follow`, `unfollow`
   - Verify signature validation

### **Features Implemented**

- ✅ **Text Messages**: Send and receive text messages
- ✅ **Rich Messages**: Carousel, buttons, quick replies
- ✅ **Media Messages**: Images, videos, audio
- ✅ **Stickers**: LINE sticker support
- ✅ **User Profiles**: Profile picture and name retrieval
- ✅ **Real-time Updates**: Socket.IO integration
- ✅ **Message History**: Complete conversation history
- ✅ **Webhook Security**: HMAC-SHA256 signature verification

### **API Endpoints**

- `POST /webhook/line` - Receive LINE webhook events
- `POST /api/send-line-message` - Send LINE message
- `GET /api/conversations` - List LINE conversations
- `GET /api/conversations/:id/messages` - Get LINE message history

---

## **✅ WhatsApp Integration (Complete)**

### **Setup Requirements**

1. **Twilio Account**
   - Create account at [Twilio Console](https://console.twilio.com/)
   - Get Account SID and Auth Token
   - Navigate to WhatsApp sandbox settings

2. **Environment Configuration**
   ```env
   TWILIO_ACCOUNT_SID=AC1234567890abcdef
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_WHATSAPP_PHONE_NUMBER=+14155238886
   ```

3. **WhatsApp Sandbox Setup**
   - Use sandbox number: `+14155238886`
   - Send "join <sandbox-code>" to activate
   - Configure webhook URL: `https://yourdomain.com/webhook/whatsapp`

### **Features Implemented**

- ✅ **Text Messages**: Send and receive text messages
- ✅ **Media Messages**: Images, videos, audio, documents
- ✅ **Template Messages**: Approved WhatsApp templates
- ✅ **Interactive Messages**: Buttons, lists, carousels
- ✅ **User Profiles**: Basic profile management
- ✅ **Real-time Updates**: Socket.IO integration
- ✅ **Message History**: Complete conversation history
- ✅ **Webhook Security**: Twilio signature verification
- ✅ **Rate Limiting**: Twilio API rate limit handling

### **API Endpoints**

- `POST /webhook/whatsapp` - Receive WhatsApp webhook events
- `GET /webhook/whatsapp` - Webhook verification
- `POST /api/send-whatsapp-message` - Send WhatsApp message
- `GET /api/conversations` - List WhatsApp conversations

### **Message Types Supported**

#### **Incoming Messages**
- Text messages
- Images (with captions)
- Videos (with captions)
- Audio messages
- Documents (with filenames)
- Location (coordinates)
- Contacts (contact cards)

#### **Outgoing Messages**
- Text messages
- Media messages (images, videos, audio, documents)
- Template messages (approved templates)
- Interactive messages (buttons, lists, carousels)

---

## **🔄 Facebook Messenger Integration (Ready)**

### **Setup Requirements**

1. **Facebook Developer Account**
   - Create app at [Facebook Developers](https://developers.facebook.com/)
   - Add Messenger product
   - Get Page Access Token and App Secret

2. **Environment Configuration**
   ```env
   FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_VERIFY_TOKEN=your_verify_token
   ```

3. **Webhook Configuration**
   - Webhook URL: `https://yourdomain.com/webhook/facebook`
   - Subscribe to events: `messages`, `messaging_postbacks`
   - Verify webhook with verify token

### **Planned Features**

- 🔄 **Text Messages**: Send and receive text messages
- 🔄 **Rich Messages**: Carousel, buttons, quick replies
- 🔄 **Media Messages**: Images, videos, audio
- 🔄 **User Profiles**: Profile picture and name retrieval
- 🔄 **Real-time Updates**: Socket.IO integration
- 🔄 **Message History**: Complete conversation history
- 🔄 **Webhook Security**: HMAC-SHA256 signature verification

---

## **🔄 WeChat Integration (Ready)**

### **Setup Requirements**

1. **WeChat Official Account**
   - Register at [WeChat Official Account Platform](https://mp.weixin.qq.com/)
   - Get AppID and AppSecret
   - Configure server URL and token

2. **Environment Configuration**
   ```env
   WECHAT_APP_ID=your_app_id
   WECHAT_APP_SECRET=your_app_secret
   WECHAT_TOKEN=your_verify_token
   ```

3. **Webhook Configuration**
   - Server URL: `https://yourdomain.com/webhook/wechat`
   - Verify signature with token
   - Handle message events

### **Planned Features**

- 🔄 **Text Messages**: Send and receive text messages
- 🔄 **Rich Messages**: Articles, cards, menus
- 🔄 **Media Messages**: Images, voice, video
- 🔄 **Location Messages**: GPS coordinates
- 🔄 **User Profiles**: Profile picture and name retrieval
- 🔄 **Real-time Updates**: Socket.IO integration
- 🔄 **Message History**: Complete conversation history
- 🔄 **Webhook Security**: SHA1 signature verification

---

## **🔧 Development Setup**

### **Adding a New Platform**

1. **Create Platform Adapter**
   ```javascript
   // src/adapters/NewPlatformAdapter.js
   const BaseAdapter = require('./BaseAdapter');
   
   class NewPlatformAdapter extends BaseAdapter {
     constructor(config) {
       super('newplatform', config);
       this.apiBaseUrl = config.apiBaseUrl;
       this.accessToken = config.accessToken;
     }
     
     async sendMessage(userId, message) {
       // Platform-specific API call
       const response = await fetch(`${this.apiBaseUrl}/send`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${this.accessToken}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           to: userId,
           message: message
         })
       });
       
       return await response.json();
     }
     
     async handleWebhook(payload) {
       // Process incoming webhook
       const message = this.extractMessage(payload);
       await this.processIncomingMessage(message);
     }
     
     async getUserProfile(userId) {
       // Fetch user profile from platform API
       const response = await fetch(`${this.apiBaseUrl}/users/${userId}`, {
         headers: {
           'Authorization': `Bearer ${this.accessToken}`
         }
       });
       
       return await response.json();
     }
   }
   
   module.exports = NewPlatformAdapter;
   ```

2. **Add Webhook Route**
   ```javascript
   // src/routes/webhooks.js
   app.post('/webhook/newplatform', async (req, res) => {
     try {
       const adapter = platformManager.getAdapter('newplatform');
       await adapter.handleWebhook(req.body);
       res.status(200).send('OK');
     } catch (error) {
       console.error('Webhook processing error:', error);
       res.status(500).send('Error processing webhook');
     }
   });
   ```

3. **Register in Platform Manager**
   ```javascript
   // src/services/platformManager.js
   const NewPlatformAdapter = require('../adapters/NewPlatformAdapter');
   
   const newPlatformConfig = {
     apiBaseUrl: process.env.NEWPLATFORM_API_URL,
     accessToken: process.env.NEWPLATFORM_ACCESS_TOKEN,
     webhookPath: '/webhook/newplatform'
   };
   
   const newPlatformAdapter = new NewPlatformAdapter(newPlatformConfig);
   platformManager.registerAdapter('newplatform', newPlatformAdapter);
   ```

4. **Add Frontend Support**
   ```typescript
   // omni-react-app/src/utils/platforms.ts
   export const PLATFORMS = {
     LINE: 'line',
     WHATSAPP: 'whatsapp',
     FACEBOOK: 'facebook',
     WECHAT: 'wechat',
     NEWPLATFORM: 'newplatform'
   } as const;
   
   export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];
   ```

---

## **🛡️ Security Features**

### **Webhook Security**

All platforms implement signature verification:

#### **LINE Webhook Security**
```javascript
const crypto = require('crypto');

function verifyLineSignature(body, signature, secret) {
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}
```

#### **WhatsApp Webhook Security (Twilio)**
```javascript
const twilio = require('twilio');

function verifyTwilioSignature(url, params, signature, authToken) {
  return twilio.validateRequest(authToken, signature, url, params);
}
```

#### **Facebook Webhook Security**
```javascript
const crypto = require('crypto');

function verifyFacebookSignature(body, signature, secret) {
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('hex');
  return `sha256=${hash}` === signature;
}
```

### **Rate Limiting**

Platform-specific rate limiting:

```javascript
// Platform-specific rate limiters
const platformRateLimiters = {
  line: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // LINE allows 1000 messages per minute
    message: 'LINE rate limit exceeded'
  }),
  
  whatsapp: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // WhatsApp allows 100 messages per minute
    message: 'WhatsApp rate limit exceeded'
  }),
  
  facebook: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 500, // Facebook allows 500 messages per minute
    message: 'Facebook rate limit exceeded'
  })
};
```

---

## **📊 Message Processing Pipeline**

### **Incoming Message Flow**

1. **Webhook Reception**: Platform sends webhook to our endpoint
2. **Signature Verification**: Validate webhook authenticity
3. **Message Extraction**: Parse platform-specific message format
4. **User Management**: Create or update user profile
5. **Conversation Management**: Create or update conversation
6. **Message Storage**: Store message in database
7. **Real-time Broadcasting**: Emit Socket.IO events
8. **Frontend Update**: Update UI with new message

### **Outgoing Message Flow**

1. **User Input**: Agent sends message via frontend
2. **Platform Detection**: Determine target platform
3. **Message Validation**: Validate message content and format
4. **Platform API Call**: Send message via platform API
5. **Response Processing**: Handle API response
6. **Message Storage**: Store sent message in database
7. **Real-time Broadcasting**: Emit Socket.IO events
8. **Status Updates**: Handle delivery confirmations

---

## **🧪 Testing**

### **Platform Integration Tests**

```javascript
// test/platform-integration.test.js
describe('Platform Integration', () => {
  test('LINE message sending', async () => {
    const response = await request(app)
      .post('/api/send-line-message')
      .send({
        conversationId: 'conv_line_test123',
        message: 'Test LINE message'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  test('WhatsApp message sending', async () => {
    const response = await request(app)
      .post('/api/send-whatsapp-message')
      .send({
        conversationId: 'conv_whatsapp_+1234567890',
        message: 'Test WhatsApp message'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### **Webhook Testing**

```bash
# Test LINE webhook
curl -X POST http://localhost:3000/webhook/line \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: your_signature" \
  -d '{"events":[{"type":"message","message":{"type":"text","text":"Hello"},"source":{"userId":"user123"}}]}'

# Test WhatsApp webhook
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'MessageSid=SM123&From=whatsapp:+1234567890&To=whatsapp:+14155238886&Body=Hello%20WhatsApp!'
```

---

## **📈 Monitoring & Analytics**

### **Platform Metrics**

Track key metrics for each platform:

- **Message Volume**: Messages sent/received per platform
- **Response Time**: API response times
- **Error Rates**: Failed message deliveries
- **User Engagement**: Active users per platform
- **Webhook Health**: Webhook delivery success rates

### **Real-time Monitoring**

```javascript
// Platform health monitoring
const platformHealth = {
  line: {
    status: 'healthy',
    lastMessage: new Date(),
    errorRate: 0.1,
    responseTime: 150
  },
  whatsapp: {
    status: 'healthy',
    lastMessage: new Date(),
    errorRate: 0.05,
    responseTime: 200
  }
};
```

---

## **🚀 Deployment**

### **Production Configuration**

1. **Environment Variables**
   ```env
   # Production environment
   NODE_ENV=production
   PORT=3000
   
   # Platform credentials
   LINE_CHANNEL_ACCESS_TOKEN=prod_line_token
   LINE_CHANNEL_SECRET=prod_line_secret
   TWILIO_ACCOUNT_SID=prod_twilio_sid
   TWILIO_AUTH_TOKEN=prod_twilio_token
   
   # Security
   JWT_SECRET=production_jwt_secret_32_chars_minimum
   ENCRYPTION_KEY=production_encryption_key_32_bytes_hex
   ```

2. **Webhook URLs**
   - LINE: `https://yourdomain.com/webhook/line`
   - WhatsApp: `https://yourdomain.com/webhook/whatsapp`
   - Facebook: `https://yourdomain.com/webhook/facebook`
   - WeChat: `https://yourdomain.com/webhook/wechat`

3. **SSL Certificates**
   - All webhook endpoints require HTTPS
   - Use Let's Encrypt or commercial SSL certificates
   - Configure HSTS headers

---

## **🔍 Troubleshooting**

### **Common Issues**

#### **LINE Integration Issues**
- **Webhook not receiving**: Check LINE Developer Console webhook URL
- **Signature verification failed**: Verify LINE_CHANNEL_SECRET
- **Message not sending**: Check LINE_CHANNEL_ACCESS_TOKEN permissions

#### **WhatsApp Integration Issues**
- **Sandbox not working**: Send "join <sandbox-code>" to activate
- **Webhook verification failed**: Check Twilio Console webhook URL
- **Rate limiting**: Implement exponential backoff for retries

#### **General Platform Issues**
- **Database connection**: Check DATABASE_URL configuration
- **Socket.IO connection**: Verify CORS settings
- **Message duplication**: Check deduplication logic

### **Debug Commands**

```bash
# Check platform health
curl http://localhost:3000/api/health

# Test webhook endpoints
curl -X POST http://localhost:3000/webhook/line -d '{"test":"data"}'
curl -X POST http://localhost:3000/webhook/whatsapp -d '{"test":"data"}'

# Check conversations
curl http://localhost:3000/api/conversations

# Monitor logs
tail -f logs/app-$(date +%Y-%m-%d).log
```

---

## **📚 Resources**

### **Platform Documentation**
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform/)
- [WeChat Official Account API](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)

### **Integration Examples**
- [LINE Bot Examples](https://github.com/line/line-bot-sdk-nodejs)
- [Twilio WhatsApp Examples](https://github.com/twilio/twilio-node)
- [Facebook Messenger Examples](https://github.com/fbsamples/messenger-platform-samples)

---

## **✅ Integration Checklist**

### **For Each Platform**

- [ ] **Account Setup**: Create developer account
- [ ] **Credentials**: Get API keys and secrets
- [ ] **Webhook Configuration**: Set webhook URL
- [ ] **Adapter Implementation**: Create platform adapter
- [ ] **Webhook Route**: Add webhook endpoint
- [ ] **Message Sending**: Implement send message API
- [ ] **User Management**: Handle user profiles
- [ ] **Security**: Implement signature verification
- [ ] **Rate Limiting**: Configure platform-specific limits
- [ ] **Testing**: Test message flow
- [ ] **Monitoring**: Add health checks
- [ ] **Documentation**: Update API documentation

---

**🎉 Your OmniChat platform now supports multiple chat platforms with unified management!**

For questions or support, check the main documentation files:
- [README.md](README.md) - Project overview and setup
- [API.md](API.md) - Complete API documentation
- [DEVELOPMENT.md](DEVELOPMENT.md) - Developer guide
- [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) - Security features
