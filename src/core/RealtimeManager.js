// src/core/RealtimeManager.js
const EventEmitter = require('events');
const logger = require('../utils/logger');

class RealtimeManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.messageQueue = [];
    this.isProcessing = false;
  }

  // Initialize real-time communication
  async initialize(io) {
    this.io = io;
    this.setupSocketHandlers();
    this.startMessageProcessor();
    logger.info('✅ RealtimeManager initialized');
  }

  // Setup Socket.IO handlers
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`🔌 Client connected: ${socket.id}`);
      this.connections.set(socket.id, {
        socket,
        userId: null,
        conversations: new Set(),
        lastActivity: Date.now()
      });

      // Handle message sending
      socket.on('send_message', async (data) => {
        try {
          await this.handleMessageSend(socket, data);
        } catch (error) {
          logger.error('Message send error:', error);
          socket.emit('message_error', { error: error.message });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle read receipts
      socket.on('mark_message_read', (data) => {
        this.handleMessageRead(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  // Handle message sending with proper error handling
  async handleMessageSend(socket, data) {
    const { conversationId, content, type = 'text' } = data;
    
    // Validate input
    if (!conversationId || !content) {
      throw new Error('Missing required fields');
    }

    // Create message object
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      content,
      type,
      sender_type: 'agent',
      sender: {
        id: 'agent',
        name: 'Agent',
        platform: 'omni'
      },
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    // Emit confirmation to sender
    socket.emit('message_sent', {
      messageId: message.id,
      conversationId,
      status: 'sent',
      timestamp: message.timestamp
    });

    // Broadcast to conversation room
    socket.to(`conversation_${conversationId}`).emit('new_message', {
      conversationId,
      message
    });

    // Queue for database storage
    this.queueMessage(message);

    logger.info('Message sent successfully', { messageId: message.id, conversationId });
  }

  // Handle typing indicators
  handleTypingStart(socket, data) {
    const { userId, userName, conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId,
      userName: userName || 'User',
      isTyping: true,
      timestamp: new Date().toISOString()
    });
  }

  handleTypingStop(socket, data) {
    const { userId, userName, conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId,
      userName: userName || 'User',
      isTyping: false,
      timestamp: new Date().toISOString()
    });
  }

  // Handle read receipts
  handleMessageRead(socket, data) {
    const { messageId, userId, conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('message_read', {
      messageId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  // Handle disconnection
  handleDisconnection(socket) {
    const connection = this.connections.get(socket.id);
    if (connection) {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
      this.connections.delete(socket.id);
    }
  }

  // Queue message for database storage
  queueMessage(message) {
    this.messageQueue.push(message);
    if (!this.isProcessing) {
      this.processMessageQueue();
    }
  }

  // Process message queue
  async processMessageQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      try {
        await this.storeMessage(message);
      } catch (error) {
        logger.error('Failed to store message:', error);
        // Re-queue message for retry
        this.messageQueue.unshift(message);
        break;
      }
    }
    
    this.isProcessing = false;
  }

  // Store message in database
  async storeMessage(message) {
    // This will be implemented with proper database integration
    logger.info('Storing message:', message.id);
  }

  // Start message processor
  startMessageProcessor() {
    setInterval(() => {
      this.processMessageQueue();
    }, 1000);
  }

  // Join conversation room
  joinConversation(socket, conversationId) {
    socket.join(`conversation_${conversationId}`);
    const connection = this.connections.get(socket.id);
    if (connection) {
      connection.conversations.add(conversationId);
    }
  }

  // Leave conversation room
  leaveConversation(socket, conversationId) {
    socket.leave(`conversation_${conversationId}`);
    const connection = this.connections.get(socket.id);
    if (connection) {
      connection.conversations.delete(conversationId);
    }
  }

  // Broadcast to conversation
  broadcastToConversation(conversationId, event, data) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  // Get connection info
  getConnectionInfo(socketId) {
    return this.connections.get(socketId);
  }

  // Get all connections
  getAllConnections() {
    return Array.from(this.connections.values());
  }
}

module.exports = RealtimeManager;
















