const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const crypto = require('crypto');
const ErrorHandler = require('./utils/errorHandler');
const config = require('./config/appConfig');
const profileCache = require('./services/profileCacheService');
const dataStorage = require('./services/legacyDataStorageService');
const redisCache = require('./services/redisCacheService');
const logger = require('./utils/logger');

// Import WhatsApp services
const TwilioWhatsAppAdapter = require('./adapters/TwilioWhatsAppAdapter');
const WhatsAppWebhookHandler = require('./services/whatsappWebhookHandler');

// Import Security Services
const SecurityMiddleware = require('./middleware/securityMiddleware');
const AuditLogger = require('./services/auditLogger');
const DataEncryption = require('./services/dataEncryption');
const ApiVersioning = require('./services/apiVersioning');
const { authenticateToken, optionalAuth } = require('./middleware/auth');
const { validateWebhook } = require('./middleware/webhookSecurity');
const { generateCSRFToken, validateCSRFToken, getCSRFToken } = require('./middleware/csrfMiddleware');

require('dotenv').config();

// Import new services
const DatabaseMigration = require('./services/databaseMigration');
const PlatformAdapter = require('./services/platformAdapter');
const MessageQueueService = require('./services/messageQueueService');
const UniversalRealtimeService = require('./services/universalRealtimeService');
const { createAiModule } = require('./ai');

class DynamicOmniServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Use configuration for Socket.IO setup
    const serverConfig = config.getServerConfig();
    this.io = new Server(this.server, {
  cors: {
        origin: ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Initialize services
    this.db = null;
    this.pgPool = null; // PostgreSQL connection
    this.messageQueue = null; // RabbitMQ connection
    this.platformAdapters = new Map(); // Platform adapter pattern
    this.databaseMigration = new DatabaseMigration();
    this.universalRealtime = null; // Universal real-time service
    this.redisCache = null; // Redis cache
    this.aiOrchestrator = null;
    this.aiRouter = null;
    
    // Initialize WhatsApp services
    this.whatsappAdapter = null;
    this.whatsappWebhookHandler = null;
    
    // Initialize Security Services
    this.securityMiddleware = new SecurityMiddleware();
    this.auditLogger = new AuditLogger();
    this.dataEncryption = new DataEncryption();
    this.apiVersioning = new ApiVersioning();
    
    // Configuration
    this.config = config;
    this.serverConfig = serverConfig;

    this.initialize();
  }

  async initialize() {
    this.setupMiddleware();
    await this.setupDatabase();
    await this.setupAiServices();
    await this.setupRedisCache();
    await this.setupMessageQueue();
    this.setupPlatformAdapters();
    await this.setupUniversalRealtime();
    await this.setupWhatsAppServices();
    this.setupRoutes();
    this.setupSocketIO();
    this.startServer();
  }

  setupMiddleware() {
    // Log security initialization
    this.auditLogger.logSystem('SECURITY_INIT', 'system', {
      timestamp: new Date().toISOString(),
      securityFeatures: ['XSS Protection', 'Input Validation', 'Rate Limiting', 'Audit Logging', 'Data Encryption', 'API Versioning']
    });
    
    // FIXED: Trust proxy for rate limiting (fixes X-Forwarded-For header error)
    this.app.set('trust proxy', 1);
    
    // Security headers (comprehensive)
    this.app.use(this.securityMiddleware.getSecurityHeaders());
    
    // Input validation and sanitization
    this.app.use(this.securityMiddleware.getInputValidation());
    
    // Rate limiting
    const rateLimiters = this.securityMiddleware.getRateLimiters();
    this.app.use('/api', rateLimiters.general);
    this.app.use('/api/send-message', rateLimiters.message);
    this.app.use('/webhook', rateLimiters.webhook);

    // CORS configuration
    this.app.use(cors({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173"
      ],
      credentials: true
    }));

    // Ensure LINE webhook gets raw body for signature verification BEFORE JSON parser
    this.app.use('/webhook/line', express.raw({ type: 'application/json' }));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Add request ID middleware for tracking
    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // Add logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        logger.httpRequest(req, res, responseTime);
      });
      
      next();
    });

    // CSRF Token generation (skip webhooks)
    this.app.use(generateCSRFToken);

    // JWT Authentication for API endpoints (skip webhooks, health checks)
    this.app.use((req, res, next) => {
      // Skip authentication for webhook endpoints and health check
      if (req.path.startsWith('/webhook/') || req.path === '/api/health') {
        return next();
      }
      
      // Skip authentication in development mode for easier testing
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
        return next();
      }
      
      // Apply authentication for API endpoints
      if (req.path.startsWith('/api/')) {
        return optionalAuth(req, res, next); // Use optional auth for backwards compatibility
      }
      
      next();
    });

    // CRITICAL FIX: CSRF validation - ONLY for non-webhook POST/PUT/DELETE
    // Webhooks and message sending endpoints MUST be exempted
    this.app.use((req, res, next) => {
      // Skip CSRF for:
      // 1. ALL webhooks
      // 2. Health checks
      // 3. GET requests
      // 4. Message sending endpoints (they're internal API calls)
      if (req.path.startsWith('/webhook/') || 
          req.path === '/api/health' ||
          req.path.startsWith('/api/ai') ||
          req.path === '/api/send-line-message' ||
          req.path === '/api/send-whatsapp-message' ||
          req.path === '/api/send-message-to-user' ||
          req.method === 'GET' ||
          req.method === 'OPTIONS' ||
          req.method === 'HEAD') {
        return next();
      }
      
      // Apply CSRF validation only for other POST API requests
      return validateCSRFToken(req, res, next);
    });

    logger.info('Middleware setup complete', { type: 'system_init' });
  }

  async setupDatabase() {
    const startTime = Date.now();
    
    try {
      // Initialize standardized data storage service
      const sqliteConfig = this.config.getSQLiteConfig();
      await dataStorage.initialize(sqliteConfig.path);
      
      // Keep legacy database setup for compatibility
      this.db = dataStorage.db;
      
      const duration = Date.now() - startTime;
      logger.databaseOperation('initialize', 'database', duration, {
        strategy: dataStorage.storageStrategy,
        path: sqliteConfig.path
      });
      
      logger.info('Data Storage initialized', {
        type: 'system_init',
        strategy: dataStorage.storageStrategy.toUpperCase(),
        duration: `${duration}ms`
      });
    } catch (error) {
      logger.error('Database initialization failed', error, {
        type: 'system_error',
        operation: 'database_init'
      });
      throw error;
    }
  }

  async setupAiServices() {
    try {
      const aiModule = createAiModule({
        db: this.db,
        getRecentMessages: async (conversationId) => {
          const result = await dataStorage.getMessages(conversationId, { limit: 10, order: 'ASC' });
          return result;
        },
        sendMessage: async ({ conversationId, message, platform }) => {
          if (platform === 'whatsapp') {
            return this.sendWhatsAppMessage(conversationId, message);
          }
          return this.sendMessageToUser(conversationId, message, platform || 'line');
        }
      });
      this.aiOrchestrator = aiModule.orchestrator;
      this.aiRouter = aiModule.router;
      await this.aiOrchestrator.initialize();
    } catch (error) {
      logger.warn('AI module failed to initialize (chat continues without AI)', {
        type: 'system_init',
        component: 'ai',
        error: error.message
      });
      this.aiOrchestrator = {
        maybeAutoReply: async () => ({ skipped: true, reason: 'unavailable' })
      };
      this.aiRouter = express.Router();
    }
  }

  triggerAiAutoReply(ctx) {
    if (!this.aiOrchestrator || typeof this.aiOrchestrator.maybeAutoReply !== 'function') {
      return;
    }
    setImmediate(() => {
      this.aiOrchestrator.maybeAutoReply(ctx).catch((err) => {
        logger.warn('AI auto-reply skipped', { error: err.message });
      });
    });
  }

  async setupRedisCache() {
    const startTime = Date.now();
    
    try {
      const connected = await redisCache.initialize();
      
      if (connected) {
        this.redisCache = redisCache;
        const duration = Date.now() - startTime;
        logger.info('Redis cache initialized successfully', {
          type: 'system_init',
          component: 'redis',
          duration: `${duration}ms`
        });
      } else {
        logger.warn('Redis not available, using in-memory cache only', {
          type: 'system_init',
          component: 'redis'
        });
      }
    } catch (error) {
      logger.error('Redis cache initialization failed', error, {
        type: 'system_error',
        component: 'redis'
      });
      // Don't throw - continue without Redis
    }
  }

  async setupMessageQueue() {
    this.messageQueue = new MessageQueueService();
    const connected = await this.messageQueue.initialize();
    
    if (connected) {
      logger.info('RabbitMQ message queue connected', { type: 'system_init', component: 'messageQueue' });
      // Set up message consumers
      await this.setupMessageConsumers();
    } else {
      logger.warn('Using in-memory message queue (fallback)', { type: 'system_init', component: 'messageQueue' });
    }
  }

  async setupMessageConsumers() {
    if (!this.messageQueue || !this.messageQueue.isConnected) return;

    // LINE incoming messages
    await this.messageQueue.consumeMessages('line.messages.incoming', async (message) => {
      logger.info('Processing LINE incoming message from queue', { type: 'message_processing', platform: 'line', source: 'queue' });
      await this.processIncomingMessage(message);
    });

    // LINE outgoing messages
    await this.messageQueue.consumeMessages('line.messages.outgoing', async (message) => {
      logger.info('Processing LINE outgoing message from queue', { type: 'message_processing', platform: 'line', source: 'queue' });
      await this.processOutgoingMessage(message);
    });

    // Notifications
    await this.messageQueue.consumeMessages('omni.notifications', async (message) => {
      logger.info('Processing notification from queue', { type: 'notification', source: 'queue' });
      await this.processNotification(message);
    });
  }

  async setupPlatformAdapters() {
    // LINE adapter
    const lineAdapter = new PlatformAdapter('line', {
      webhookPath: '/webhook/line',
      apiBaseUrl: 'https://api.line.me/v2/bot/message',
      accessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
      messageTypes: ['text', 'image', 'file', 'sticker']
    });
    this.platformAdapters.set('line', lineAdapter);

    // WhatsApp adapter (ready for future implementation)
    const whatsappAdapter = new PlatformAdapter('whatsapp', {
      webhookPath: '/webhook/whatsapp',
      apiBaseUrl: 'https://graph.facebook.com/v18.0/me/messages',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
      messageTypes: ['text', 'image', 'document', 'audio', 'video']
    });
    this.platformAdapters.set('whatsapp', whatsappAdapter);

    // Telegram adapter (ready for future implementation)
    const telegramAdapter = new PlatformAdapter('telegram', {
      webhookPath: '/webhook/telegram',
      apiBaseUrl: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      messageTypes: ['text', 'photo', 'document', 'audio', 'video', 'voice']
    });
    this.platformAdapters.set('telegram', telegramAdapter);

    logger.info(`Platform adapters initialized: ${Array.from(this.platformAdapters.keys()).join(', ')}`, { type: 'system_init', component: 'platformAdapters', platforms: Array.from(this.platformAdapters.keys()) });
  }

  async processIncomingMessage(message) {
    // Process incoming message from queue
    logger.debug('Processing incoming message', { type: 'message_processing', message });
    // This would integrate with existing message processing logic
  }

  async processOutgoingMessage(message) {
    // Process outgoing message from queue
    logger.debug('Processing outgoing message', { type: 'message_processing', message });
    // This would integrate with existing message sending logic
  }

  async processNotification(message) {
    // Process notification from queue
    logger.debug('Processing notification', { type: 'notification', message });
    // This would integrate with Socket.IO for real-time notifications
    this.io.emit('notification', message);
  }

  setupUniversalRealtime() {
    // Initialize universal real-time service
    this.universalRealtime = new UniversalRealtimeService(this.io, dataStorage);
    logger.info('Universal real-time service initialized', { type: 'system_init', component: 'realTime' });
    logger.info('Multi-platform real-time support enabled', { type: 'system_init', component: 'realTime' });
  }

  async setupWhatsAppServices() {
    try {
      // Check if WhatsApp is configured
      if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        logger.warn('WhatsApp not configured - skipping WhatsApp services', { type: 'system_init', component: 'whatsapp' });
        return;
      }

      // Initialize Twilio WhatsApp adapter
      this.whatsappAdapter = new TwilioWhatsAppAdapter({
        accountSid: process.env.TWILIO_ACCOUNT_SID || process.env.WHATSAPP_ACCESS_TOKEN,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.WHATSAPP_PHONE_NUMBER_ID,
        verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      });

      // Initialize WhatsApp webhook handler
      this.whatsappWebhookHandler = new WhatsAppWebhookHandler({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0'
      });

      // Validate WhatsApp configuration
      if (this.whatsappWebhookHandler.validateConfiguration()) {
        logger.info('WhatsApp services initialized successfully', { 
          type: 'system_init', 
          component: 'whatsapp',
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
          apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0'
        });
      } else {
        logger.error('WhatsApp configuration validation failed', null, { type: 'system_init', component: 'whatsapp' });
      }
    } catch (error) {
      logger.error('Failed to setup WhatsApp services', error, { type: 'system_error', component: 'whatsapp' });
    }
  }

  setupRoutes() {
    // Setup API versioning
    this.apiVersioning.setupVersionedRoutes(this.app);

    if (this.aiRouter) {
      this.app.use('/api/ai', this.aiRouter);
    }
    
    // ========== WEBHOOK ROUTES ==========
    
    // LINE webhook (raw body for signature)
    this.app.post('/webhook/line', express.raw({ type: 'application/json' }), async (req, res) => {
      try {
        console.log(`📱 LINE webhook received at ${new Date().toISOString()}`);
        
        // Parse the raw buffer to JSON
        let bodyText;
        if (Buffer.isBuffer(req.body)) {
          bodyText = req.body.toString('utf8');
        } else {
          bodyText = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }
        
        console.log(`   Body length: ${bodyText.length}`);

        // Verify webhook signature (CRITICAL SECURITY)
        const signature = req.headers['x-line-signature'];
        if (!validateWebhook('line', { body: bodyText, bodyText: bodyText, headers: req.headers })) {
          logger.error('LINE webhook signature validation failed', null, { type: 'security', platform: 'line', ip: req.ip });
          this.auditLogger.logSecurity('LINE_WEBHOOK_INVALID_SIGNATURE', 'system', req.ip, {
            path: req.path,
            bodyLength: bodyText.length
          });
          return res.status(403).json({ 
            success: false, 
            error: 'Invalid webhook signature',
            timestamp: new Date().toISOString()
          });
        }
        console.log('✅ LINE webhook signature validated');

        // Parse JSON
        const events = JSON.parse(bodyText);
        console.log(`   Events: ${events.events?.length || 0}`);

        for (const event of events.events || []) {
          console.log(`   Processing event: ${event.type} from ${event.source?.userId || 'Unknown'}`);
          try {
            await this.handleLineEvent(event);
            console.log(`   ✅ Event processed successfully: ${event.type}`);
          } catch (error) {
            logger.error(`Event processing failed: ${event.type}`, error, { type: 'webhook', platform: 'line', eventType: event.type });
          }
        }

        console.log(`✅ Webhook processing completed`);
        res.json({ 
          success: true, 
          message: 'Webhook processed',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Webhook error', error, { type: 'webhook', platform: 'line', path: req.path });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // WhatsApp webhook
    this.app.post('/webhook/whatsapp', express.json(), async (req, res) => {
      try {
        console.log(`📱 WHATSAPP webhook received at ${new Date().toISOString()}`);
        
        // Handle ngrok browser warning bypass
        if (req.headers['user-agent']?.includes('ngrok') && !req.body.MessageSid) {
          console.log('📱 WHATSAPP: ngrok browser warning detected, responding with 200');
          return res.status(200).end();
        }
        
        // Handle empty body requests
        if (!req.body || Object.keys(req.body).length === 0) {
          console.log('📱 WHATSAPP: Empty body request detected, responding with 200');
          return res.status(200).end();
        }
        
        if (!this.whatsappWebhookHandler) {
          console.log('❌ WhatsApp webhook handler not initialized');
          return res.status(503).json({ success: false, error: 'WhatsApp service not available' });
        }

        // Verify webhook signature (with environment-based bypass for development)
        const skipSignatureValidation = process.env.SKIP_WEBHOOK_SIGNATURE === 'true' || 
                                        process.env.TWILIO_SANDBOX_MODE === 'true' ||
                                        process.env.NODE_ENV === 'development';
        
        if (!skipSignatureValidation) {
          const isValidSignature = validateWebhook('whatsapp', {
            url: req.protocol + '://' + req.get('host') + req.originalUrl,
            body: req.body,
            headers: req.headers
          });
          
          if (!isValidSignature && req.headers['x-hub-signature-256']) {
            logger.error('WHATSAPP: Webhook signature validation failed', null, { type: 'security', platform: 'whatsapp', ip: req.ip });
            this.auditLogger.logSecurity('WHATSAPP_WEBHOOK_INVALID_SIGNATURE', 'system', req.ip, {
              path: req.path
            });
            return res.status(403).json({ 
              success: false, 
              error: 'Invalid webhook signature',
              timestamp: new Date().toISOString()
            });
          }
          console.log('✅ WHATSAPP: Webhook signature validated');
        } else {
          console.log(`📱 WHATSAPP: Signature verification skipped (${process.env.NODE_ENV} mode)`);
        }
        
        // Process Twilio WhatsApp webhook
        const twilioMessage = req.body;
        
        if (twilioMessage.Level === 'ERROR' || twilioMessage.error_code) {
          console.log(`📱 WHATSAPP: Received Twilio error message - skipping processing`);
          return res.status(200).end();
        }
        
        const businessNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_PHONE_NUMBER || '14155238886'}`;
        const isInboundMessage = twilioMessage.From && twilioMessage.From !== businessNumber;
        const hasValidBody = twilioMessage.Body && twilioMessage.Body.trim() !== '';
        const isStatusUpdate = req.body.MessageStatus && ['delivered', 'read', 'failed', 'sent'].includes(req.body.MessageStatus);
        const isRealMessage = hasValidBody && !isStatusUpdate && twilioMessage.Body.length > 0;
        
        if (isInboundMessage && isRealMessage) {
          console.log(`📱 WHATSAPP: Processing inbound message...`);
          try {
            await this.processTwilioWhatsAppMessage(twilioMessage);
            console.log(`📱 WHATSAPP: Message processing completed successfully`);
          } catch (error) {
            logger.error('WHATSAPP: Message processing failed', error, { type: 'webhook', platform: 'whatsapp' });
          }
        }
        
        res.status(200).end();
      } catch (error) {
        logger.error('WHATSAPP webhook error', error, { type: 'webhook', platform: 'whatsapp', path: req.path });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // WhatsApp webhook verification (GET request)
    this.app.get('/webhook/whatsapp', (req, res) => {
      const challenge = req.query['hub.challenge'];
      if (challenge) {
        console.log('✅ WHATSAPP webhook verification successful');
        res.status(200).send(challenge);
      } else {
        res.status(200).send('OK');
      }
    });

    // ========== API ROUTES ==========
    
    // CSRF token endpoint
    this.app.get('/api/csrf-token', (req, res) => {
      return getCSRFToken(req, res);
    });
    
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const stats = await this.getStats();
        res.json({
          success: true,
          message: 'Server is running',
          data: {
            database: 'SQLite',
            platforms: Array.from(this.platformAdapters.keys()),
            messageQueue: this.messageQueue?.inMemory ? 'In-Memory' : 'RabbitMQ',
            socketClients: this.io.engine.clientsCount,
            ...stats
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get conversations
    this.app.get('/api/conversations', async (req, res) => {
      try {
        const conversations = await this.getConversations();
        res.json({ success: true, conversations });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get messages for a specific conversation
    this.app.get('/api/conversations/:conversationId/messages', async (req, res) => {
      try {
        const { conversationId } = req.params;
        // FIXED: Remove limit restriction - support unlimited messages
        const { limit = 9999, offset = 0, order = 'DESC' } = req.query;

        logger.debug('Getting messages', { conversationId, limit, offset, order });

        // Get from both data storage AND database for sync verification
        const dataStorageMessages = await this.getMessages(conversationId, {
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: (order || 'DESC').toString().toUpperCase()
        });

        // Also query database directly to ensure sync
        const dbMessages = await new Promise((resolve, reject) => {
          this.db.all(
            `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ${order} LIMIT ? OFFSET ?`,
            [conversationId, parseInt(limit), parseInt(offset)],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        const total = await new Promise((resolve, reject) => {
          this.db.get(
            'SELECT COUNT(*) AS cnt FROM messages WHERE conversation_id = ?',
            [conversationId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row?.cnt || 0);
            }
          );
        });

        logger.debug('Messages retrieved', { 
          conversationId, 
          dataStorageCount: dataStorageMessages.length,
          dbCount: dbMessages.length,
          total 
        });

        res.json({ success: true, messages: dataStorageMessages, total, syncStatus: { 
          dataStorage: dataStorageMessages.length,
          database: dbMessages.length,
          synced: dataStorageMessages.length === dbMessages.length
        }});
      } catch (error) {
        logger.error('Error getting messages', error, { type: 'api', endpoint: 'get_messages', conversationId });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Send message to LINE user
    this.app.post('/api/send-line-message', async (req, res) => {
      try {
        const { conversationId, message } = req.body;
        
        if (!conversationId || !message) {
          return res.status(400).json({ success: false, error: 'Missing conversationId or message' });
        }

        const recentMessage = await this.checkRecentMessage(conversationId, message);
        if (recentMessage) {
          return res.json({
            success: true,
            message: 'Message already sent recently',
            duplicate: true,
            messageId: recentMessage.id
          });
        }

        const result = await this.sendMessageToUser(conversationId, message, 'line');
        res.json({ success: true, message: 'LINE message sent', data: result });
      } catch (error) {
        logger.error('LINE send message error', error, { type: 'api', endpoint: 'send_line_message', conversationId });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Send message to WhatsApp user
    this.app.post('/api/send-whatsapp-message', async (req, res) => {
      try {
        const { conversationId, message } = req.body;
        
        // Security validation
        try {
          const validatedConversationId = this.securityMiddleware.validateConversationId(conversationId);
          const validatedMessage = this.securityMiddleware.validateMessageContent(message);
          
          this.auditLogger.logMessage('SEND_ATTEMPT', req.user?.id || 'anonymous', validatedConversationId, 'whatsapp', null, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            messageLength: validatedMessage.length
          });
          
        } catch (validationError) {
          this.auditLogger.logSecurity('VALIDATION_FAILED', req.user?.id || 'anonymous', req.ip, {
            error: validationError.message,
            conversationId
          });
          
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid input data',
            details: validationError.message 
          });
        }
        
        if (!conversationId || !message) {
          return res.status(400).json({ success: false, error: 'Missing conversationId or message' });
        }

        const recentMessage = await this.checkRecentMessage(conversationId, message);
        if (recentMessage) {
          return res.json({
            success: true,
            message: 'Message already sent recently',
            duplicate: true,
            messageId: recentMessage.id
          });
        }

        const result = await this.sendWhatsAppMessage(conversationId, message);
        res.json({ success: true, message: 'WhatsApp message sent', data: result });
      } catch (error) {
        logger.error('WhatsApp send message error', error, { type: 'api', endpoint: 'send_whatsapp_message', conversationId });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Legacy endpoint for backward compatibility
    this.app.post('/api/send-message-to-user', async (req, res) => {
      try {
        const { conversationId, message, platform } = req.body;
        
        if (!conversationId || !message) {
          return res.status(400).json({ success: false, error: 'Missing conversationId or message' });
        }

        const targetPlatform = platform || 'line';
        const recentMessage = await this.checkRecentMessage(conversationId, message);
        if (recentMessage) {
          return res.json({
            success: true,
            message: 'Message already sent recently',
            duplicate: true,
            messageId: recentMessage.id
          });
        }

        let result;
        if (targetPlatform === 'whatsapp') {
          result = await this.sendWhatsAppMessage(conversationId, message);
        } else {
          result = await this.sendMessageToUser(conversationId, message, 'line');
        }
        
        res.json({ success: true, message: 'Message sent', data: result });
      } catch (error) {
        logger.error('Send message error', error, { type: 'api', endpoint: 'send_message_to_user', conversationId });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Proxy endpoint for LINE profile pictures (fixes CORS/400 errors)
    this.app.get('/api/proxy-profile-picture', async (req, res) => {
      try {
        const { url, platform, userId } = req.query;
        
        if (!url || platform !== 'line') {
          return res.status(400).json({ success: false, error: 'Invalid parameters' });
        }

        // Only proxy LINE CDN URLs that would return 400
        if (url.includes('profile.line-scdn.net')) {
          try {
            const response = await axios.get(url, {
              headers: {
                'User-Agent': 'LINE Bot/Omni Platform',
                'Referer': 'https://developers.line.biz/'
              },
              responseType: 'arraybuffer',
              timeout: 5000
            });
            
            // Set proper content type based on response headers
            const contentType = response.headers['content-type'] || 'image/jpeg';
            
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600'
            });
            
            return res.send(response.data);
          } catch (proxyError) {
            // If proxy fails, return a simple placeholder image
            console.log(`⚠️ Profile picture proxy failed for ${userId}: ${proxyError.message}`);
            return res.status(404).send('Profile picture not available');
          }
        }
        
        // For non-LINE URLs, redirect to original URL
        return res.redirect(url);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Cache statistics endpoints
    this.app.get('/api/cache/stats', async (req, res) => {
      try {
        const stats = profileCache.getStats();
        res.json({ success: true, data: { cache: stats, timestamp: new Date().toISOString() } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/cache/clear', async (req, res) => {
      try {
        profileCache.clearCache();
        res.json({ success: true, message: 'Cache cleared successfully', timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/storage/stats', async (req, res) => {
      try {
        const stats = await dataStorage.getStorageStats();
        res.json({ success: true, data: { storage: stats, timestamp: new Date().toISOString() } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/logger/stats', async (req, res) => {
      try {
        const logger = require('./utils/logger');
        const stats = logger.getStats();
        res.json({ success: true, data: { logger: stats, timestamp: new Date().toISOString() } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/redis/stats', async (req, res) => {
      try {
        const stats = this.redisCache ? await this.redisCache.getStats() : { connected: false };
        res.json({ success: true, data: { redis: stats, timestamp: new Date().toISOString() } });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    logger.info('Routes setup complete', { type: 'system_init', component: 'routes' });
    
    // Add error handling middleware (must be last)
    this.app.use(ErrorHandler.handleApiError);
  }

  setupSocketIO() {
    const { setupSecureSocketHandlers } = require('./middleware/socketAuth');
    const logger = require('./utils/logger');
    const ErrorHandler = require('./utils/errorHandler');
    
    // Setup Socket.IO with security (enabled - development mode allows unauthenticated connections)
    if (process.env.NODE_ENV === 'production') {
      setupSecureSocketHandlers(this.io);
    }
    
    // Legacy Socket.IO handlers (for backward compatibility)
    this.io.on('connection', (socket) => {
      logger.socketEvent('connection', socket.id, {
        totalClients: this.io.engine.clientsCount
      });

      socket.on('disconnect', () => {
        logger.socketEvent('disconnect', socket.id, {
          remainingClients: this.io.engine.clientsCount
        });
      });

      socket.on('join_conversation', (conversationId) => {
        try {
          socket.join(conversationId);
          logger.socketEvent('join_conversation', socket.id, {
            conversationId,
            roomSize: this.io.sockets.adapter.rooms.get(conversationId)?.size || 0
          });
        } catch (error) {
          logger.error('Socket join conversation error', error, {
            socketId: socket.id,
            conversationId
          });
          ErrorHandler.handleSocketError(error, socket, 'join_conversation');
        }
      });

      socket.on('leave_conversation', (conversationId) => {
        try {
          socket.leave(conversationId);
          logger.socketEvent('leave_conversation', socket.id, {
            conversationId,
            roomSize: this.io.sockets.adapter.rooms.get(conversationId)?.size || 0
          });
        } catch (error) {
          logger.error('Socket leave conversation error', error, {
            socketId: socket.id,
            conversationId
          });
          ErrorHandler.handleSocketError(error, socket, 'leave_conversation');
        }
      });
    });

    logger.info('Socket.IO setup complete', { type: 'system_init' });
  }

  async handleLineEvent(event) {
    try {
      console.log(`📱 Processing LINE event: ${event.type}`);
      
      if (event.type === 'message') {
        await this.handleLineMessage(event);
      } else if (event.type === 'follow') {
        await this.handleLineFollow(event);
      }
    } catch (error) {
      logger.error('Event handling error', error, { type: 'event_handling', eventType: event.type });
    }
  }

  async updateConversationLastMessage(conversationId, message) {
    try {
      await dataStorage.updateConversationLastMessage(conversationId, {
        last_message: message.content,
        last_message_at: message.timestamp,
        message_count: await dataStorage.getConversationMessageCount(conversationId) + 1
      });
      console.log('📱 WHATSAPP: Conversation updated with last message');
    } catch (error) {
      logger.error('WHATSAPP: Failed to update conversation', error, { type: 'database', platform: 'whatsapp', conversationId });
    }
  }

  async processTwilioWhatsAppMessage(twilioMessage) {
    try {
      console.log('📱 WHATSAPP: Processing Twilio message:', twilioMessage.MessageSid);
      
      // Extract phone number from Twilio message
      const phoneNumber = twilioMessage.From?.replace('whatsapp:', '');
      
      if (!phoneNumber) {
        console.log('❌ WHATSAPP: No phone number found in Twilio message');
        return;
      }

      console.log('📱 WHATSAPP: Processing message from:', phoneNumber);

      // Get or create WhatsApp user
      const user = await this.getOrCreateWhatsAppUser(phoneNumber);
      console.log('📱 WHATSAPP: User found/created:', user.id);

      // Get or create WhatsApp conversation
      const conversation = await this.getOrCreateWhatsAppConversation(phoneNumber, user);
      console.log('📱 WHATSAPP: Conversation found/created:', conversation.id);

      // Create message object
      const message = {
        id: `msg_whatsapp_${twilioMessage.MessageSid}`,
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_name: user.name,
        sender_type: 'user',
        message_type: 'text',
        content: twilioMessage.Body,
        platform: 'whatsapp',
        platform_message_id: twilioMessage.MessageSid,
        status: 'received',
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      // Save message
      await dataStorage.saveMessage(message);
      console.log('📱 WHATSAPP: Message saved:', message.id);

      // Update conversation
      await this.updateConversationLastMessage(conversation.id, message);

      // Emit real-time events - ENHANCED MULTIPLE STRATEGIES for reliability
      const eventData = {
        message: message,
        conversation: conversation,
        user: user,
        platform: 'whatsapp'
      };

      console.log('📱 WHATSAPP: Emitting real-time events for message:', message.id);
      console.log('📱 WHATSAPP: Event data:', JSON.stringify(eventData, null, 2));

      // Strategy 1: Emit to all clients with multiple event types
      this.io.emit('new_message', eventData);
      this.io.emit('whatsapp_message', eventData);
      this.io.emit('user_message', eventData);
      this.io.emit('message_received', eventData);
      this.io.emit('incoming_message', eventData);
      this.io.emit('real_user_message', eventData);

      // Strategy 2: Emit to conversation room
      this.io.to(conversation.id).emit('new_message', eventData);
      this.io.to(conversation.id).emit('whatsapp_message', eventData);
      this.io.to(conversation.id).emit('user_message', eventData);
      this.io.to(conversation.id).emit('message_received', eventData);
      this.io.to(conversation.id).emit('incoming_message', eventData);

      // Strategy 3: Emit to platform-specific room
      this.io.to('whatsapp').emit('new_message', eventData);
      this.io.to('whatsapp').emit('whatsapp_message', eventData);
      this.io.to('whatsapp').emit('user_message', eventData);

      // Strategy 4: Emit direct message data (fallback)
      this.io.emit('new_message', message);
      this.io.emit('whatsapp_message', message);
      this.io.emit('user_message', message);

      // Strategy 5: Call platform-specific API endpoint for additional processing
      try {
        const apiResponse = await axios.post('http://localhost:3000/api/store-whatsapp-message', {
          conversationId: conversation.id,
          message: message
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        console.log('📱 WHATSAPP: Platform-specific API called successfully');
      } catch (apiError) {
        console.log('📱 WHATSAPP: Platform-specific API call failed (non-critical):', apiError.message);
      }

      console.log('📱 WHATSAPP: Real-time events emitted for message:', message.id);
      console.log('📱 WHATSAPP: Events sent to all clients, conversation room, platform room, and direct message');

      this.triggerAiAutoReply({
        conversationId: conversation.id,
        platform: 'whatsapp',
        incomingMessage: message
      });

    } catch (error) {
      logger.error('WHATSAPP: Failed to process Twilio message', error, { type: 'webhook', platform: 'whatsapp', messageSid: twilioMessage.MessageSid });
      throw error;
    }
  }

  async processWhatsAppMessage(messageData) {
    try {
      console.log('📱 Processing WHATSAPP message:', messageData.message_type);
      console.log(`📱 UNIVERSAL: WHATSAPP message from ${messageData.sender_id}: ${messageData.content}`);
      
      // Get or create user
      const user = await this.getOrCreateWhatsAppUser(messageData.sender_id);
      console.log('👤 Found existing WHATSAPP user:', user.name);
      
      // Get or create conversation
      const conversation = await this.getOrCreateWhatsAppConversation(messageData.sender_id, user);
      console.log('💬 Found existing conversation:', conversation.id);
      
      // Update message data with user info
      const enhancedMessageData = {
        ...messageData,
        sender_id: user.id,
        sender_name: user.name,
        conversation_id: conversation.id
      };
      
      // Process through universal real-time service
      console.log('🌐 UNIVERSAL: Processing whatsapp real-user message');
      console.log(`   Message: ${enhancedMessageData.content}`);
      console.log(`   Conversation: ${conversation.id}`);
      
      const result = await this.universalRealtime.processMessage('whatsapp', enhancedMessageData, conversation.id);
      
      if (result.success) {
        console.log(`✅ UNIVERSAL: WHATSAPP message processed successfully: ${result.messageId}`);
        
        // Emit real-time events
        this.io.emit('real_user_message', {
          id: result.messageId,
          conversationId: conversation.id,
          senderId: user.id,
          senderName: user.name,
          content: enhancedMessageData.content,
          messageType: enhancedMessageData.message_type,
          platform: 'whatsapp',
          timestamp: new Date().toISOString(),
          profilePictureUrl: user.profile_picture_url
        });
        
        console.log(`📥 REAL-TIME: Emitted WHATSAPP real-user message to all clients: ${result.messageId}`);
      } else {
        console.error('❌ UNIVERSAL: Failed to process WHATSAPP message:', result.error);
      }
    } catch (error) {
      logger.error('Failed to process WHATSAPP message', error, { type: 'message_processing', platform: 'whatsapp', senderId: messageData.sender_id });
      throw error;
    }
  }

  async handleLineMessage(event) {
    const userId = event.source.userId;
    const message = event.message;
    const platformMessageId = message?.id || null;
    
    // Reduced logging for performance
    logger.debug('LINE message received', { userId, messageLength: message.text?.length });

    try {
      // Get or create user
      const user = await this.getOrCreateLineUser(userId);
      
      // Get or create conversation
      const conversation = await this.getOrCreateConversation(userId, user);
      
      // Create message object for direct storage with proper ID generation
      // Use timestamp + random to ensure uniqueness
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const messageId = platformMessageId || `line_${timestamp}_${random}`;
      
      const messageToStore = {
        id: messageId,
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_name: user.name || conversation.user_name || `LINE User ${userId.substring(0, 8)}`,
        sender_type: 'user',
        message_type: 'text',
        content: message.text,
        platform: 'line',
        platform_message_id: platformMessageId,
        status: 'received',
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // CRITICAL: Save message to database FIRST (reliability)
      await dataStorage.saveMessage(messageToStore);
      logger.debug('Message saved', { messageId: messageToStore.id, platform: 'line' });

      // Process using universal service (for real-time sync)
      const messageData = {
        sender_id: user.id,
        sender_name: user.name || conversation.user_name || `LINE User ${userId.substring(0, 8)}`,
        content: message.text,
        message_type: 'text',
        platform_message_id: platformMessageId || `line_${Date.now()}`,
        additional_data: {
          reply_token: event.replyToken
        }
      };

      // Try universal service (non-blocking)
      try {
        const result = await this.universalRealtime.processRealUserMessage('line', messageData, conversation.id);
        if (result.success) {
          logger.debug('LINE message processed by universal service', { messageId: result.messageId });
        }
      } catch (universalError) {
        logger.debug('Universal service failed (non-critical)', { error: universalError.message });
      }
      
      // Real-time emission - ENHANCED with sender profile data
      const realTimeMessage = {
        id: messageToStore.id,
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_name: user.name || conversation.user_name || `LINE User ${userId.substring(0, 8)}`,
        sender_type: 'user',
        message_type: 'text',
        content: message.text,
        platform: 'line',
        status: 'received',
        created_at: messageToStore.created_at,
        timestamp: messageToStore.timestamp,
        sender: {
          id: user.id,
          name: user.name || conversation.user_name || `LINE User ${userId.substring(0, 8)}`,
          platform: 'line',
          profile_picture_url: user.profile_picture_url || conversation.profile_picture_url || null
        }
      };
      
      // Emit to conversation room and globally
      this.io.to(conversation.id).emit('new_message', realTimeMessage);
      this.io.to(conversation.id).emit('message_received', realTimeMessage);
      this.io.to(conversation.id).emit('user_message', realTimeMessage);
      
      this.io.emit('new_message', realTimeMessage);
      this.io.emit('message_received', realTimeMessage);
      this.io.emit('user_message', realTimeMessage);
      
      logger.debug('LINE message processed and synced', { messageId: messageToStore.id });

      this.triggerAiAutoReply({
        conversationId: conversation.id,
        platform: 'line',
        incomingMessage: messageToStore
      });
    } catch (error) {
      logger.error('Failed to handle LINE message', error, { type: 'webhook', platform: 'line', userId });
      throw error;
    }
  }

  async handleLineFollow(event) {
    const userId = event.source.userId;
    logger.info('LINE follow event', { userId });
    
    // Get or create user
    const user = await this.getOrCreateLineUser(userId);
    
    // Get or create conversation
    const conversation = await this.getOrCreateConversation(userId, user);
    
    logger.info('User added to system', { userId, conversationId: conversation.id });
  }

  async getOrCreateLineUser(userId) {
    try {
      // Try Redis cache first
      if (this.redisCache?.isConnected) {
        const cachedProfile = await this.redisCache.getUserProfile('line', userId);
        if (cachedProfile) {
          logger.debug('User profile retrieved from Redis cache', { platform: 'line', userId });
          return cachedProfile;
        }
      }

      // Try to get existing user using dataStorage
      const users = await dataStorage.getUsers();
      const existingUser = users.find(user => user.platform_id === userId && user.platform === 'line');
      
      if (existingUser) {
        // PROXY FIX: Convert LINE CDN URLs to proxy URLs for existing users too
        if (existingUser.profile_picture_url && existingUser.profile_picture_url.includes('profile.line-scdn.net') && !existingUser.profile_picture_url.includes('/api/proxy')) {
          const port = this.port || process.env.OMNI_SERVER_PORT || 3000;
          const proxyUrl = `http://localhost:${port}/api/proxy-profile-picture?url=${encodeURIComponent(existingUser.profile_picture_url)}&platform=line&userId=${userId}`;
          existingUser.profile_picture_url = proxyUrl;
          // Update in database
          await dataStorage.saveUser(existingUser);
        }
        
        // Cache the user profile
        if (this.redisCache?.isConnected) {
          await this.redisCache.cacheUserProfile('line', userId, existingUser);
        }
        return existingUser;
      }

      // Create new user
      let profile;
      try {
        profile = await this.getLineUserProfile(userId);
      } catch (error) {
        profile = {
          displayName: `LINE User ${userId.substring(0, 8)}`,
          pictureUrl: null,
          statusMessage: ''
        };
      }
      
      // PROXY FIX: Convert LINE CDN URLs to proxy URLs
      let profilePictureUrl = profile.pictureUrl || null;
      
      // If it's a LINE CDN URL, convert it to our proxy endpoint
      if (profilePictureUrl && profilePictureUrl.includes('profile.line-scdn.net')) {
        const port = this.port || process.env.OMNI_SERVER_PORT || 3000;
        profilePictureUrl = `http://localhost:${port}/api/proxy-profile-picture?url=${encodeURIComponent(profilePictureUrl)}&platform=line&userId=${userId}`;
      }
      
      const newUser = {
        id: `user_line_${userId}`,
        platform_id: userId,
        platform: 'line',
        name: profile.displayName || `LINE User ${userId.substring(0, 8)}`,
        profile_picture_url: profilePictureUrl,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await dataStorage.saveUser(newUser);
      
      // Cache the new user
      if (this.redisCache?.isConnected) {
        await this.redisCache.cacheUserProfile('line', userId, newUser);
      }
      
      return newUser;
    } catch (error) {
      logger.error('Failed to get/create LINE user', error, { type: 'user_management', platform: 'line', userId });
      throw error;
    }
  }

  async getOrCreateWhatsAppUser(phoneNumber) {
    try {
      // Try Redis cache first
      if (this.redisCache?.isConnected) {
        const cachedProfile = await this.redisCache.getUserProfile('whatsapp', phoneNumber);
        if (cachedProfile) {
          logger.debug('User profile retrieved from Redis cache', { platform: 'whatsapp', phoneNumber });
          return cachedProfile;
        }
      }

      // Try to get existing user using dataStorage
      const users = await dataStorage.getUsers();
      const existingUser = users.find(user => user.platform_id === phoneNumber && user.platform === 'whatsapp');
      
      if (existingUser) {
        // Cache the user profile
        if (this.redisCache?.isConnected) {
          await this.redisCache.cacheUserProfile('whatsapp', phoneNumber, existingUser);
        }
        console.log(`👤 Found existing WHATSAPP user: ${existingUser.name}`);
        return existingUser;
      }

      // Create new user
      console.log(`👤 Creating new WHATSAPP user: ${phoneNumber}`);
      let profile;
      try {
        if (this.whatsappWebhookHandler) {
          profile = await this.whatsappWebhookHandler.getUserProfile(phoneNumber);
        } else {
          throw new Error('WhatsApp webhook handler not available');
        }
      } catch (error) {
        console.log(`⚠️ Could not get WHATSAPP profile for ${phoneNumber}, using fallback`);
        profile = {
          name: `WhatsApp User ${phoneNumber.substring(0, 8)}`,
          profile_picture_url: null,
          phone_number: phoneNumber
        };
      }
      
      const newUser = {
        id: `user_whatsapp_${phoneNumber}`,
        platform_id: phoneNumber,
        platform: 'whatsapp',
        name: profile.name || `WhatsApp User ${phoneNumber.substring(0, 8)}`,
        profile_picture_url: profile.profile_picture_url || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        additional_data: JSON.stringify({
          phone_number: phoneNumber,
          is_real_whatsapp_user: true
        })
      };

      await dataStorage.saveUser(newUser);
      
      // Cache the new user
      if (this.redisCache?.isConnected) {
        await this.redisCache.cacheUserProfile('whatsapp', phoneNumber, newUser);
      }
      
      console.log(`✅ Created new WHATSAPP user: ${newUser.name}`);
      return newUser;
    } catch (error) {
      logger.error('Failed to get/create WHATSAPP user', error, { type: 'user_management', platform: 'whatsapp', phoneNumber });
      throw error;
    }
  }

  async getOrCreateWhatsAppConversation(phoneNumber, user) {
    try {
      // Try to get existing conversation using dataStorage
      const conversations = await dataStorage.getConversations();
      const existingConversation = conversations.find(conv => 
        conv.platform_conversation_id === phoneNumber && conv.platform === 'whatsapp'
      );
      
      if (existingConversation) {
        console.log(`💬 Found existing WHATSAPP conversation: ${existingConversation.id}`);
        return existingConversation;
      }

      // Create new conversation
      console.log(`💬 Creating new WHATSAPP conversation: ${phoneNumber}`);
      
      // Format phone number for display (remove whatsapp: prefix and + sign)
      const displayPhoneNumber = phoneNumber.replace(/^whatsapp:/, '').replace(/^\+/, '');
      
      const newConversation = {
        id: `conv_whatsapp_${phoneNumber}`,
        user_id: user.id,
        platform: 'whatsapp',
        platform_conversation_id: phoneNumber,
        platform_user_id: phoneNumber,
        status: 'active',
        user_name: user.name, // Use clean user name
        profile_picture_url: user.profile_picture_url,
        business_account_name: 'Omni Business Account',
        last_message: null,
        last_message_at: null,
        message_count: 0,
        real_data_synced: true,
        real_sync_date: new Date().toISOString(),
        is_real_user: true,
        chat_history_synced: false,
        additional_data: JSON.stringify({
          phone_number: phoneNumber,
          business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await dataStorage.saveConversation(newConversation);
      console.log(`✅ Created new WHATSAPP conversation: ${newConversation.id}`);
      return newConversation;
    } catch (error) {
      logger.error('Failed to get/create WHATSAPP conversation', error, { type: 'conversation_management', platform: 'whatsapp', phoneNumber });
      throw error;
    }
  }

  async getOrCreateConversation(userId, user) {
    try {
      // Try to get existing conversation using dataStorage
      const conversations = await dataStorage.getConversations();
      const existingConversation = conversations.find(conv => 
        conv.platform_conversation_id === userId && conv.platform === 'line'
      );
      
      if (existingConversation) {
        return existingConversation;
      }

      // Create new conversation
      const newConversation = await this.createOrUpdateConversation(userId, user);
      return newConversation;
    } catch (error) {
      logger.error('Failed to get/create conversation', error, { type: 'conversation_management', platform: 'line', userId });
      throw error;
    }
  }

  async getLineUserProfile(userId) {
    try {
      const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
      }

      // Use profile cache service to get profile picture
      const profile = await profileCache.getLineUserProfile(userId, accessToken);
      
      logger.debug('LINE profile fetched', { userId, hasPicture: !!profile.pictureUrl });
      return profile;
      
    } catch (error) {
      logger.debug('Could not get LINE profile', { userId, error: error.message });
      return {
        displayName: `LINE User ${userId.substring(0, 8)}`,
        pictureUrl: null,
        statusMessage: ''
      };
    }
  }

  async createOrUpdateUser(userId, profile) {
    // VALIDATION: Validate user ID format and type
    if (!userId) {
      throw new Error('User ID is required and cannot be null or undefined');
    }
    
    if (typeof userId !== 'string') {
      throw new Error(`Invalid user ID type. Expected string, got ${typeof userId}`);
    }
    
    if (userId.length < 10) {
      throw new Error(`Invalid user ID length. Must be at least 10 characters, got ${userId.length}`);
    }
    
    // VALIDATION: Check for suspicious patterns
    if (userId.includes(' ') || userId.includes('\n') || userId.includes('\t')) {
      throw new Error('User ID contains invalid characters (spaces, newlines, tabs)');
    }
    
    // VALIDATION: LINE user ID format check (should start with 'U')
    if (!userId.startsWith('U')) {
      console.warn(`⚠️ Non-standard LINE user ID format: ${userId} (expected to start with 'U')`);
    }
    
    console.log(`✅ VALIDATION: User ID validated successfully: ${userId}`);
    
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO users (
          id, platform_id, platform, name, display_name, profile_picture_url,
          status, status_message, language, last_seen, additional_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `user_line_${userId}`,
        userId,
        'line',
        profile.displayName,
        profile.displayName,
        profile.pictureUrl,
        'active',
        profile.statusMessage || '',
        'en',
        new Date().toISOString(),
        JSON.stringify({ is_real_line_user: true })
      ], function(err) {
        if (err) reject(err);
        else resolve({
          id: `user_line_${userId}`,
          platform_id: userId,
          platform: 'line',
          name: profile.displayName,
          display_name: profile.displayName,
          profile_picture_url: profile.pictureUrl
        });
      });
    });
  }

  async createOrUpdateConversation(userId, user) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO conversations (
          id, user_id, platform, platform_conversation_id, platform_user_id, status,
          user_name, profile_picture_url, business_account_name,
          last_message, last_message_at, message_count,
          real_data_synced, real_sync_date, is_real_user,
          chat_history_synced, additional_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `conv_line_${userId}`,
        `user_line_${userId}`,
        'line',
        userId,
        userId,
        'active',
        user.name || user.display_name,
        user.profile_picture_url,
        'Omni Business Account',
        'Conversation started',
        new Date().toISOString(),
        0,
        true,
        new Date().toISOString(),
        true,
        false,
        null,
        new Date().toISOString(),
        new Date().toISOString()
      ], function(err) {
        if (err) reject(err);
        else resolve({
          id: `conv_line_${userId}`,
          user_id: `user_line_${userId}`,
          platform: 'line',
          platform_conversation_id: userId,
          user_name: user.display_name,
          profile_picture_url: user.profile_picture_url
        });
  });
});
  }

  async storeMessage(conversationId, senderId, content, senderType, platformMessageId = null, platform = null) {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const createdAt = new Date().toISOString();
      
      // DYNAMIC: Get platform from conversation if not provided
      let messagePlatform = platform;
      if (!messagePlatform) {
        try {
          const conversation = await this.getConversationById(conversationId);
          messagePlatform = conversation?.platform || 'line';
        } catch (error) {
          messagePlatform = 'line';
        }
      }
      
      // Create message object for dataStorage
      const messageToStore = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderId,
        sender_type: senderType,
        message_type: 'text',
        content: content,
        platform: messagePlatform,
        platform_message_id: platformMessageId,
        status: senderType === 'agent' ? 'sent' : 'received',
        created_at: createdAt,
        updated_at: createdAt
      };
      
      // Use dataStorage.saveMessage which handles INSERT OR IGNORE properly
      await dataStorage.saveMessage(messageToStore);
      
      // Emit real-time Socket.IO events
      const messageData = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderId,
        sender_type: senderType,
        message_type: 'text',
        content: content,
        platform: messagePlatform,
        status: senderType === 'agent' ? 'sent' : 'received',
        created_at: createdAt,
        timestamp: createdAt
      };
      
      // Broadcast to conversation room and globally
      this.io.to(conversationId).emit('new_message', messageData);
      this.io.to(conversationId).emit('message_received', messageData);
      
      // Global emissions
      this.io.emit('new_message', messageData);
      this.io.emit('message_received', messageData);
      if (senderType === 'agent') {
        this.io.emit('message_sent', messageData);
      } else {
        this.io.emit('user_message', messageData);
      }
      
      return { id: messageId, duplicate: false };
    } catch (error) {
      logger.error('Store message failed', error, { conversationId, senderType });
      throw error;
    }
  }

  // Enhanced deduplication method
  async checkRecentMessage(conversationId, message) {
    try {
      // FAST: Quick deduplication - Check for messages within 5 seconds
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      
      
      // Check SQLite first (if available) - STRICTER CHECK
      const sqliteCheck = await new Promise((resolve) => {
        this.db.get(
          'SELECT id, created_at, platform_message_id FROM messages WHERE conversation_id = ? AND content = ? AND sender_type = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1',
          [conversationId, message, 'agent', fiveSecondsAgo],
          (err, row) => {
            if (err) resolve(null);
            else resolve(row);
          }
        );
      });

      if (sqliteCheck) return sqliteCheck;

      // Check JSON file as fallback - STRICTER CHECK
      const messagesPath = path.join(__dirname, '../messages.json');
      if (fs.existsSync(messagesPath)) {
        const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
        const recentMessage = messages.find(msg => 
          msg.conversation_id === conversationId && 
          msg.content === message && 
          msg.sender_type === 'agent' &&
          new Date(msg.created_at) > new Date(Date.now() - 15000) // 15 seconds ago
        );
        
        if (recentMessage) return { id: recentMessage.id };
      }

      return null;
    } catch (error) {
      console.error('❌ Recent message check failed:', error.message);
      return null;
    }
  }

  async sendMessageToUser(conversationId, message, platform = 'line') {
    try {
      // Get conversation to find user
      const conversation = await this.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Extract platform user ID from conversation (dynamic, no hardcoding)
      const platformUserId = conversation.platform_user_id;
      if (!platformUserId) {
        throw new Error(`No platform user ID found for conversation ${conversationId}`);
      }
      
      // Generate unique platform message ID to prevent duplicates
      const platformMessageId = `omni_out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.debug('Sending message', { conversationId, platform, userId: platformUserId });
      
      // Enhanced deduplication: Check both SQLite and JSON for recent messages
      const recentMessageCheck = await this.checkRecentMessage(conversationId, message);

      if (recentMessageCheck) {
        logger.debug('Duplicate prevented', { messageId: recentMessageCheck.id });
        return { success: true, messageId: recentMessageCheck.id, duplicate: true };
      }
      
      // CRITICAL: Store message FIRST (before API call) to ensure persistence
      const result = await this.storeMessage(conversationId, 'omni_business', message, 'agent', platformMessageId, platform);
      
      // Route to appropriate platform API (dynamic routing, no hardcoding)
      let apiResult;
      if (platform === 'whatsapp') {
        apiResult = await this.sendWhatsAppMessage(conversationId, message);
      } else if (platform === 'line') {
        await this.sendToLineAPI(platformUserId, message);
        apiResult = { success: true, messageId: platformMessageId };
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      // Emit real-time event for agent messages - MULTIPLE STRATEGIES for reliability
      const messageData = {
        id: result.id,
        conversation_id: conversationId,
        sender_id: 'omni_business',
        sender_name: 'Omni Agent',
        sender_type: 'agent',
        message_type: 'text',
        content: message,
        platform: platform,
        status: 'sent',
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };
      
      // Strategy 1: Emit to conversation room
      this.io.to(conversationId).emit('new_message', messageData);
      this.io.to(conversationId).emit('message_sent', messageData);
      
      // Strategy 2: Emit globally for maximum reliability
      this.io.emit('new_message', messageData);
      this.io.emit('message_sent', messageData);
      this.io.emit('agent_message', messageData);
      
      logger.debug('Message sent and synced', { messageId: result.id, platform });

      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error('Send message error', error, { type: 'message_send', platform, conversationId });
      throw error;
    }
  }

  async sendWhatsAppMessage(conversationId, message) {
    try {
      // Get conversation to find user
      const conversation = await this.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (!this.whatsappAdapter) {
        throw new Error('WhatsApp adapter not initialized');
      }

      // Extract phone number from conversation
      const phoneNumber = conversation.platform_user_id;
      
      if (!phoneNumber) {
        throw new Error(`No phone number found for conversation ${conversationId}`);
      }
      
      // Clean phone number (remove whatsapp: prefix if present)
      const cleanPhoneNumber = phoneNumber.replace(/^whatsapp:/, '');
      
      // Generate unique platform message ID to prevent duplicates
      const platformMessageId = `omni_out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`📤 WHATSAPP SENDING: Message "${message}" to conversation ${conversationId}`);
      console.log(`📤 WHATSAPP SENDING: Phone number: ${cleanPhoneNumber}`);
      console.log(`📤 WHATSAPP SENDING: Platform message ID: ${platformMessageId}`);
      
      // FAST deduplication: Quick check only
      const recentMessageCheck = await this.checkRecentMessage(conversationId, message);

      if (recentMessageCheck) {
        console.log('🚫 WHATSAPP DUPLICATE PREVENTED');
        return { success: true, messageId: recentMessageCheck.id, duplicate: true };
      }
      
      // Send to WhatsApp API - WITH AGGRESSIVE RETRY for Twilio rate limits
      let whatsappResult;
      let retryCount = 0;
      const maxRetries = 5; // Increased retries
      
      // Add initial delay to avoid immediate rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      while (retryCount < maxRetries) {
        try {
          whatsappResult = await this.whatsappAdapter.sendMessage(cleanPhoneNumber, message);
          console.log(`✅ WHATSAPP: Message sent to phone number ${cleanPhoneNumber}`);
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          console.log(`❌ WHATSAPP: Attempt ${retryCount} failed:`, error.message);
          
          // Check for rate limit errors (429) or Twilio-specific errors
          const isRateLimit = error.message.includes('429') || 
                             error.message.includes('rate limit') ||
                             error.response?.status === 429 ||
                             error.response?.data?.code === 20429 ||
                             error.response?.data?.code === 63038;
          
          if (isRateLimit && retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 2000; // Longer exponential backoff: 4s, 8s, 16s, 32s
            console.log(`⏳ WHATSAPP: Rate limited, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else if (retryCount >= maxRetries) {
            console.log(`❌ WHATSAPP: Max retries reached, giving up`);
            throw error;
          } else {
            // Not a rate limit error, throw immediately
            console.log(`❌ WHATSAPP: Non-rate-limit error, throwing immediately`);
            throw error;
          }
        }
      }
      
      // Store message in database with unique platform_message_id - PREVENT DUPLICATE STORAGE
      const result = await this.storeMessage(conversationId, 'omni_business', message, 'agent', platformMessageId, 'whatsapp');
      
      // CRITICAL: Check if message was already stored (prevent duplicate storage)
      if (!result || result.duplicate) {
        console.log('🚫 DUPLICATE STORAGE PREVENTED: Message already exists in database');
        return { success: true, messageId: result?.id || platformMessageId, duplicate: true };
      }
      
      // Emit real-time event for agent messages - MULTIPLE STRATEGIES for reliability
      const messageData = {
        id: result.id,
        conversation_id: conversationId,
        sender_id: 'omni_business',
        sender_name: 'Omni Agent',
        sender_type: 'agent',
        message_type: 'text',
        content: message,
        platform: 'whatsapp',
        status: 'sent',
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        whatsappMessageId: whatsappResult.messageId
      };
      
      // Strategy 1: Emit to conversation room
      this.io.to(conversationId).emit('new_message', messageData);
      this.io.to(conversationId).emit('message_sent', messageData);
      
      // Strategy 2: Emit globally for maximum reliability
      this.io.emit('new_message', messageData);
      this.io.emit('message_sent', messageData);
      this.io.emit('agent_message', messageData);
      this.io.emit('whatsapp_message', messageData);
      
      console.log(`📤 WHATSAPP REAL-TIME: Emitted agent message to all clients: ${result.id}`);

      return { success: true, messageId: result.id, whatsappMessageId: whatsappResult.messageId };
    } catch (error) {
      console.error('❌ WHATSAPP: Send message error:', error.message);
      throw error;
    }
  }

  async sendToLineAPI(userId, message) {
    try {
      const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
      }

      const response = await axios.post('https://api.line.me/v2/bot/message/push', {
        to: userId,
        messages: [{
          type: 'text',
          text: message
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      logger.debug('LINE message sent', { userId });
      return response.data;
    } catch (error) {
      logger.error('Failed to send LINE message', error, { userId });
      throw error;
    }
  }

  async getConversations() {
    try {
      // Use standardized data storage service
      const conversations = await dataStorage.getConversations();
      return conversations;
    } catch (error) {
      console.error('❌ Failed to get conversations:', error);
      return [];
    }
  }

  async getConversationById(conversationId) {
    try {
      const fs = require('fs');
      const path = require('path');

      // Try to read from conversations.json file first
      try {
        const conversationsData = fs.readFileSync(path.join(__dirname, '../conversations.json'), 'utf8');
        const conversations = JSON.parse(conversationsData);
        const conversation = conversations.find(conv => conv.id === conversationId);
        
        if (conversation) {
          return conversation;
        }
      } catch (jsonError) {
        // Fallback to database
      }

      // Fallback to database if JSON file doesn't exist or conversation not found
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT * FROM conversations WHERE id = ?',
          [conversationId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    } catch (error) {
      console.error('❌ Failed to get conversation by ID:', error);
      return null;
    }
  }

  async getMessages(conversationId, options = {}) {
    try {
      // Use standardized data storage service
      const result = await dataStorage.getMessages(conversationId, options);
      return result.messages;
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  async getStats() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as total_users FROM users',
        (err, userCount) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.db.get(
            'SELECT COUNT(*) as total_conversations FROM conversations',
            (err, convCount) => {
              if (err) {
                reject(err);
                return;
              }
              
              this.db.get(
                'SELECT COUNT(*) as total_messages FROM messages',
                (err, msgCount) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  resolve({
                    users: userCount.total_users,
                    conversations: convCount.total_conversations,
                    messages: msgCount.total_messages
                  });
                }
              );
            }
          );
        }
      );
    });
  }

  startServer() {
    if (this._serverStarting || this.server.listening) {
      return;
    }

    this._serverStarting = true;
    this._startupMessagePrinted = false; // Prevent duplicate startup messages
    const port = this.serverConfig.port;

    const tryListen = (portToTry, attempts = 0) => {
      if (this.server.listening) {
        this._serverStarting = false;
        return;
      }
      
      // CRITICAL FIX: Prevent multiple server starts
      if (this._serverStarting && attempts > 0) {
        console.log('🚫 Server already starting, skipping duplicate attempt');
        return;
      }

      const onError = (err) => {
        if (err && err.code === 'EADDRINUSE' && attempts < 10) {
          const nextPort = Number(portToTry) + 1;
          console.warn(`⚠️ Port ${portToTry} in use, trying ${nextPort}...`);
          this.server.removeListener('error', onError);
          setTimeout(() => tryListen(nextPort, attempts + 1), 150);
          return;
        }

        console.error('❌ Server listen error:', err);
        this._serverStarting = false;
      };

      this.server.once('error', onError);
      this.server.listen(portToTry, this.serverConfig.host, () => {
        this._serverStarting = false;
        this.port = portToTry;
        
        // Store port for proxy URLs
        process.env.OMNI_SERVER_PORT = portToTry.toString();
        
        // CRITICAL FIX: Only print startup message once
        if (!this._startupMessagePrinted) {
          this._startupMessagePrinted = true;
          console.log('');
          console.log('🚀 OMNICHANNEL PLATFORM SERVER STARTED');
        console.log('=====================================');
        console.log(`📡 Server running on ${this.serverConfig.host}:${portToTry}`);
        console.log(`🔌 Socket.IO enabled`);
        console.log(`📱 LINE integration ready`);
        console.log(`🗄️ Database: SQLite`);
        console.log(`📦 Message Queue: ${this.messageQueue?.inMemory ? 'In-Memory' : 'RabbitMQ'}`);
        console.log(`🔧 Platform Adapters: ${Array.from(this.platformAdapters.keys()).join(', ')}`);
        console.log(`🌍 Environment: ${this.config.getEnvironment()}`);
        console.log('');
        console.log('🌐 Endpoints:');
        console.log(`   Health: http://localhost:${portToTry}/api/health`);
        console.log(`   LINE Webhook: http://localhost:${portToTry}/webhook/line`);
        console.log(`   WhatsApp Webhook: http://localhost:${portToTry}/webhook/whatsapp`);
        console.log(`   Conversations: http://localhost:${portToTry}/api/conversations`);
        console.log('');
        console.log('📱 Ready for multi-platform integration!');
        console.log('   ✅ LINE integration active');
        if (this.whatsappAdapter) {
          console.log('   ✅ WhatsApp integration active');
        } else {
          console.log('   ⚠️ WhatsApp integration (configure credentials to enable)');
        }
        console.log('=====================================');
        }
      });
    };

    const initialPort = Number(process.env.PORT) || 3000;
    tryListen(initialPort, 0);
  }
}

// Start the server
new DynamicOmniServer();
