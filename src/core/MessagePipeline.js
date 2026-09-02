// src/core/MessagePipeline.js
const EventEmitter = require('events');
const logger = require('../utils/logger');

class MessagePipeline extends EventEmitter {
  constructor() {
    super();
    this.processors = new Map();
    this.messageQueue = [];
    this.isProcessing = false;
    this.retryQueue = [];
    this.maxRetries = 3;
  }

  // Register message processor
  registerProcessor(platform, processor) {
    this.processors.set(platform, processor);
    logger.info(`📝 Registered processor for platform: ${platform}`);
  }

  // Process incoming message
  async processMessage(messageData) {
    try {
      logger.info('🔄 Processing message', {
        platform: messageData.platform,
        messageId: messageData.id,
        conversationId: messageData.conversationId
      });

      // Validate message data
      this.validateMessage(messageData);

      // Get processor for platform
      const processor = this.processors.get(messageData.platform);
      if (!processor) {
        throw new Error(`No processor found for platform: ${messageData.platform}`);
      }

      // Process message
      const result = await processor.process(messageData);
      
      // Emit success event
      this.emit('message_processed', {
        messageId: messageData.id,
        platform: messageData.platform,
        result
      });

      logger.info('✅ Message processed successfully', {
        messageId: messageData.id,
        platform: messageData.platform
      });

      return result;

    } catch (error) {
      logger.error('❌ Message processing failed', {
        messageId: messageData.id,
        platform: messageData.platform,
        error: error.message
      });

      // Add to retry queue
      this.addToRetryQueue(messageData, error);
      
      // Emit error event
      this.emit('message_error', {
        messageId: messageData.id,
        platform: messageData.platform,
        error: error.message
      });

      throw error;
    }
  }

  // Validate message data
  validateMessage(messageData) {
    const required = ['id', 'platform', 'conversationId', 'content'];
    const missing = required.filter(field => !messageData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!messageData.sender_type) {
      messageData.sender_type = 'user';
    }

    if (!messageData.timestamp) {
      messageData.timestamp = Date.now();
    }

    if (!messageData.created_at) {
      messageData.created_at = new Date().toISOString();
    }
  }

  // Add message to retry queue
  addToRetryQueue(messageData, error) {
    const retryItem = {
      messageData,
      error: error.message,
      retryCount: 0,
      nextRetry: Date.now() + 5000 // Retry in 5 seconds
    };
    
    this.retryQueue.push(retryItem);
    logger.info('📋 Added to retry queue', {
      messageId: messageData.id,
      retryCount: retryItem.retryCount
    });
  }

  // Process retry queue
  async processRetryQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    const now = Date.now();
    
    for (let i = this.retryQueue.length - 1; i >= 0; i--) {
      const item = this.retryQueue[i];
      
      if (now >= item.nextRetry) {
        try {
          await this.processMessage(item.messageData);
          this.retryQueue.splice(i, 1);
          logger.info('✅ Retry successful', {
            messageId: item.messageData.id,
            retryCount: item.retryCount
          });
        } catch (error) {
          item.retryCount++;
          item.nextRetry = now + (5000 * item.retryCount); // Exponential backoff
          
          if (item.retryCount >= this.maxRetries) {
            logger.error('❌ Max retries exceeded', {
              messageId: item.messageData.id,
              retryCount: item.retryCount
            });
            this.retryQueue.splice(i, 1);
            this.emit('message_failed', {
              messageId: item.messageData.id,
              error: error.message,
              retryCount: item.retryCount
            });
          }
        }
      }
    }
    
    this.isProcessing = false;
  }

  // Start retry processor
  startRetryProcessor() {
    setInterval(() => {
      this.processRetryQueue();
    }, 1000);
  }

  // Get queue status
  getQueueStatus() {
    return {
      messageQueue: this.messageQueue.length,
      retryQueue: this.retryQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // Clear queues
  clearQueues() {
    this.messageQueue = [];
    this.retryQueue = [];
    logger.info('🧹 Message queues cleared');
  }
}

module.exports = MessagePipeline;
















