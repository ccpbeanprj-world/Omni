// src/core/ServerManager.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const DatabaseManager = require('./DatabaseManager');
const RealtimeManager = require('./RealtimeManager');
const MessagePipeline = require('./MessagePipeline');
const LineProcessor = require('./processors/LineProcessor');

class ServerManager {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = null;
    this.databaseManager = new DatabaseManager();
    this.realtimeManager = new RealtimeManager();
    this.messagePipeline = new MessagePipeline();
    this.isInitialized = false;
  }

  // Initialize server
  async initialize() {
    try {
      // Initialize database
      await this.databaseManager.initialize();
      
      // Initialize Socket.IO
      this.initializeSocketIO();
      
      // Initialize message pipeline
      this.initializeMessagePipeline();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      this.isInitialized = true;
      console.log('✅ ServerManager initialized successfully');
      
    } catch (error) {
      console.error('❌ ServerManager initialization failed:', error);
      throw error;
    }
  }

  // Initialize Socket.IO
  initializeSocketIO() {
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      allowEIO3: true,
      transports: ['polling', 'websocket'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Initialize realtime manager
    this.realtimeManager.initialize(this.io);
    
    console.log('✅ Socket.IO initialized');
  }

  // Initialize message pipeline
  initializeMessagePipeline() {
    // Register LINE processor
    const lineProcessor = new LineProcessor(this.databaseManager);
    this.messagePipeline.registerProcessor('line', lineProcessor);
    
    // Setup message pipeline events
    this.messagePipeline.on('message_processed', (data) => {
      console.log('✅ Message processed:', data.messageId);
    });
    
    this.messagePipeline.on('message_error', (data) => {
      console.error('❌ Message processing error:', data.error);
    });
    
    this.messagePipeline.on('message_failed', (data) => {
      console.error('❌ Message processing failed after retries:', data.messageId);
    });
    
    // Start retry processor
    this.messagePipeline.startRetryProcessor();
    
    console.log('✅ Message pipeline initialized');
  }

  // Setup middleware
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    }));

    // CORS middleware
    this.app.use(cors({
      origin: [
        process.env.FRONTEND_URL || "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:5174"
      ],
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    this.app.use('/uploads', express.static('uploads'));
    this.app.use(express.static('public'));

    console.log('✅ Middleware setup complete');
  }

  // Setup routes
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: this.databaseManager.getStatus(),
        messagePipeline: this.messagePipeline.getQueueStatus()
      });
    });

    // LINE webhook
    this.app.post('/webhook/line', async (req, res) => {
      try {
        console.log('🔵 LINE webhook received:', JSON.stringify(req.body, null, 2));
        
        // Validate signature
        const signature = req.headers['x-line-signature'];
        if (!this.validateLineSignature(req.body, signature)) {
          console.log('❌ Invalid LINE signature');
          return res.status(403).send('Forbidden');
        }

        // Process webhook
        const messages = await this.processLineWebhook(req.body);
        
        // Process each message
        for (const message of messages) {
          try {
            await this.messagePipeline.processMessage(message);
          } catch (error) {
            console.error('❌ Message processing failed:', error);
          }
        }

        res.status(200).send('OK');
        
      } catch (error) {
        console.error('❌ LINE webhook error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // API routes
    this.app.get('/api/conversations', async (req, res) => {
      try {
        const { platform, limit = 10, offset = 0 } = req.query;
        
        let query = `
          SELECT c.*, u.name as user_name, u.profile_picture_url
          FROM conversations c
          LEFT JOIN users u ON c.user_id = u.id
        `;
        
        const params = [];
        if (platform) {
          query += ' WHERE c.platform = $1';
          params.push(platform);
        }
        
        query += ' ORDER BY c.updated_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await this.databaseManager.query(query, params);
        
        res.json({
          success: true,
          conversations: result.rows
        });
        
      } catch (error) {
        console.error('❌ API error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    console.log('✅ Routes setup complete');
  }

  // Setup error handling
  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      if (req.originalUrl.startsWith('/socket.io/')) {
        return;
      }
      res.status(404).json({ error: 'Route not found' });
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      console.error('❌ Server error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    });

    console.log('✅ Error handling setup complete');
  }

  // Process LINE webhook
  async processLineWebhook(payload) {
    const events = payload.events || [];
    const messages = [];

    for (const event of events) {
      if (event.type === 'message') {
        const message = {
          id: event.message.id,
          from: event.source.userId,
          timestamp: event.timestamp,
          type: event.message.type,
          text: event.message.text || '',
          platform: 'line',
          conversationId: event.source.userId,
          sender_type: 'user',
          sender: {
            id: event.source.userId,
            name: 'LINE User',
            platform: 'line'
          },
          status: 'received',
          created_at: new Date(event.timestamp).toISOString()
        };
        messages.push(message);
      }
    }

    return messages;
  }

  // Validate LINE signature
  validateLineSignature(payload, signature) {
    const crypto = require('crypto');
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    
    if (!channelSecret || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', channelSecret)
      .update(JSON.stringify(payload))
      .digest('base64');

    return signature === expectedSignature;
  }

  // Start server
  async start(port = 3000, host = '0.0.0.0') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.server.listen(port, host, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`🚀 Server running on ${host}:${port}`);
          resolve();
        }
      });
    });
  }

  // Stop server
  async stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.databaseManager.close();
        console.log('🛑 Server stopped');
        resolve();
      });
    });
  }
}

module.exports = ServerManager;
















