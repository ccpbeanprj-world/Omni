# Next Phase Roadmap - Omni-Channel Platform

> **Partially outdated.** LINE and Twilio WhatsApp **are** the live Omni inbox. Facebook and WeChat are still not on `src/server.js`. SQLite is still default. Use [README.md](README.md) and `.cursor/rules/add-platform.mdc` when adding a channel. Scores below are historical.

**Original target score**: 95/100 (historical)

---

## 🎯 Current Status vs Requirements

| Requirement | Current | Needed | Priority |
|-------------|---------|--------|----------|
| ✅ WhatsApp Integration | Working (Twilio) | Keep | - |
| ❌ Facebook Messenger | Not started | Needed | 🔴 **Critical** |
| ❌ WeChat Integration | Not started | Critical | 🔴 **Critical** |
| ⚠️ PostgreSQL | SQLite only | Production ready | 🟡 High |
| ⚠️ Test Coverage | <50% | >80% | 🟡 High |
| ⚠️ CI/CD | Not setup | Needed | 🟡 Medium |

---

## 📋 Next Phase Implementation Plan

### Phase 1: Platform Integration (Weeks 1-4)

#### Week 1-2: Facebook Messenger Integration

**Task 1: Setup Facebook App** (1 day)
```bash
# 1. Create Facebook Developer Account
# 2. Create App with Messenger product
# 3. Get Page Access Token
# 4. Configure webhook URL: https://yourdomain.com/webhook/messenger
```

**Task 2: Implement Facebook Handler** (2-3 days)
- Add `src/services/facebookWebhookHandler.js`
- Webhook verification (HMAC-SHA256)
- Message receiving from Messenger
- Message sending to Messenger
- Follow guide in `FACEBOOK_ECOSYSTEM_INTEGRATION.md`

**Task 3: Frontend Integration** (1-2 days)
- Add Facebook platform to frontend
- Platform selector in UI
- Facebook-specific UI indicators
- Test with ngrok locally

**Expected Output**:
- ✅ Facebook Messenger webhook receiving messages
- ✅ Sending messages to Facebook users
- ✅ Real-time sync working

#### Week 2-3: WeChat Integration (CRITICAL)

**Task 1: WeChat Business Setup** (3-5 days)
- Apply for WeChat Official Account (Service Account)
- Get AppID and AppSecret
- Configure server URL and Token
- Pass verification process

**Task 2: Implement WeChat Handler** (2-3 days)
```javascript
// src/services/wechatWebhookHandler.js
class WeChatWebhookHandler {
  // Verify signature
  verifyWebhook(req, res, token) {
    const { signature, timestamp, nonce, echostr } = req.query;
    const tmpArr = [token, timestamp, nonce].sort();
    const tmpStr = tmpArr.join('');
    const hash = crypto.createHash('sha1').update(tmpStr).digest('hex');
    
    if (hash === signature) {
      res.send(echostr);
    } else {
      res.sendStatus(403);
    }
  }
  
  // Handle messages (text format XML)
  async handleMessage(xmlData) {
    // Parse XML message
    // Extract: ToUserName, FromUserName, Content, MsgType
    // Store in database
    // Emit Socket.IO event
  }
  
  // Send message
  async sendMessage(userId, content) {
    const accessToken = await this.getAccessToken();
    const apiUrl = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`;
    
    await axios.post(apiUrl, {
      touser: userId,
      msgtype: 'text',
      text: { content }
    });
  }
}
```

**Task 3: Frontend Integration** (1-2 days)
- Add WeChat to platform list
- WeChat-specific styling (WeChat green color)
- WeChat media handling

**Expected Output**:
- ✅ WeChat webhook receiving messages
- ✅ Sending messages to WeChat users  
- ✅ Support for WeChat-specific features

---

### Phase 2: Production Readiness (Weeks 4-6)

#### Week 4: PostgreSQL Migration

**Why**: SQLite not suitable for production scale

**Steps**:
```bash
# 1. Setup PostgreSQL database
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=omni \
  -p 5432:5432 postgres:14

# 2. Update .env
DATABASE_URL=postgresql://user:password@localhost:5432/omni
```

**Code Changes**:
- Update `src/config/database.js` to support PostgreSQL
- Create migration scripts
- Migrate existing SQLite data
- Update connection pooling

**Expected Output**:
- ✅ PostgreSQL database running
- ✅ Data migrated successfully
- ✅ Connection pooling configured

#### Week 5: Test Coverage (>80%)

**Target**: Increase test coverage from <50% to >80%

**Focus Areas**:
```javascript
// Priority 1: Webhook handlers
- test/unit/webhookHandlers.test.js
- test LINE webhook ✓
- test WhatsApp webhook ✓  
- test Facebook webhook
- test WeChat webhook

// Priority 2: Adapters
- test/unit/adapters.test.js
- test all platform adapters

// Priority 3: Services
- test/unit/services.test.js
- test message queue
- test profile caching
```

**Add E2E Tests**:
```javascript
// test/e2e/realtime-sync.test.js
test('LINE message appears in real-time', async () => {
  // Simulate LINE webhook
  // Verify Socket.IO event
  // Verify UI update
});
```

**Expected Output**:
- ✅ Unit tests >80% coverage
- ✅ Integration tests for all platforms
- ✅ E2E tests for critical flows

#### Week 6: CI/CD Pipeline

**Setup GitHub Actions**:
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Add deployment steps
```

**Expected Output**:
- ✅ Automated testing on commit
- ✅ Automatic deployment to staging
- ✅ Production deployment pipeline

---

### Phase 3: Optimization (Weeks 7-8)

#### Performance Improvements

1. **Load Balancing** (Week 7)
```yaml
# Add nginx configuration
upstream omni_backend {
  server localhost:3000;
  server localhost:3001;
  server localhost:3002;
}

server {
  listen 80;
  location / {
    proxy_pass http://omni_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

2. **Monitoring & Logging** (Week 7)
```javascript
// Add Prometheus metrics
const promClient = require('prom-client');

const register = new promClient.Registry();
register.setDefaultLabels({ app: 'omni-platform' });
promClient.collectDefaultMetrics({ register });

// Add Express middleware
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

3. **Caching Optimization** (Week 8)
```javascript
// Implement Redis for sessions
// Cache profile pictures
// Cache conversation lists
```

---

## 🔒 Security Improvements Needed

### Current Security: 95/100 ✅
**Excellent**, but add these for 100/100:

1. **MFA Support**
```javascript
// Add TOTP/Google Authenticator
const speakeasy = require('speakeasy');

// Generate secret
const secret = speakeasy.generateSecret();

// Verify TOTP
const verified = speakeasy.totp.verify({
  secret: secret.base32,
  token: userProvidedToken,
  window: 2
});
```

2. **Session Management**
```javascript
// Add session expiration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    httpOnly: true
  }
}));
```

3. **Security Headers**
```javascript
// Add additional headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

---

## 📊 Expected Improvements

### After Next Phase:

| Area | Current | After | Improvement |
|------|---------|-------|-------------|
| Platform Coverage | 40% (2/5) | 100% (5/5) | +60% |
| Security | 95/100 | 100/100 | +5% |
| Test Coverage | <50% | >80% | +30% |
| Database | SQLite | PostgreSQL | Production ready |
| CI/CD | None | Full pipeline | Automated |
| **Overall Score** | **86/100** | **95/100** | **+9 points** |

---

## 💰 Cost Estimation

| Item | Cost | Timeline |
|------|------|----------|
| Developer Time | $8,000-12,000 | 6-8 weeks |
| Facebook App Review | Free | 1-2 weeks |
| WeChat Verification | $100-300/year | 2-3 weeks |
| PostgreSQL Setup | Free (self-hosted) | 1 day |
| CI/CD Setup | Free (GitHub Actions) | 2 days |
| **Total** | **$8,100-12,300** | **6-8 weeks** |

---

## 🎯 Success Criteria

### Must Have (Critical):
- ✅ Facebook Messenger working
- ✅ WeChat working  
- ✅ PostgreSQL migration complete
- ✅ Test coverage >80%
- ✅ CI/CD pipeline running

### Should Have (High Priority):
- ⚠️ Load balancing
- ⚠️ Monitoring dashboard
- ⚠️ MFA for admin accounts

### Nice to Have (Medium Priority):
- Instagram integration
- Telegram integration
- Advanced analytics

---

## 📝 Documentation Status

### Kept (Essential):
- ✅ README.md
- ✅ API.md
- ✅ DEVELOPMENT.md
- ✅ SECURITY_IMPLEMENTATION.md
- ✅ PLATFORM_INTEGRATION.md
- ✅ TESTING_GUIDE.md
- ✅ PROJECT_EVALUATION_REPORT.md
- ✅ FACEBOOK_ECOSYSTEM_INTEGRATION.md
- ✅ **NEXT_PHASE_ROADMAP.md** (this file)

### Removed (Redundant):
- ❌ All fix/status documents (already cleaned)
- ❌ Changelog (integrated into roadmap)

---

## 🚀 Immediate Actions (This Week)

1. ✅ **Today**: Review and approve this roadmap
2. ✅ **Day 1-2**: Setup Facebook Developer Account
3. ✅ **Day 3-4**: Implement Facebook webhook handler
4. ✅ **Day 5-7**: Test Facebook integration with ngrok
5. ✅ **Week 2**: Start WeChat integration

---

## 📞 Support

For detailed technical implementation, refer to:
- `DEVELOPMENT.md` - Development workflow
- `API.md` - API reference  
- `FACEBOOK_ECOSYSTEM_INTEGRATION.md` - Facebook guide
- `PLATFORM_INTEGRATION.md` - Integration patterns

**Let's build a production-ready, scalable Omni-Channel Platform!** 🚀











