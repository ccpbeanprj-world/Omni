#!/usr/bin/env node

/**
 * Universal Real-Time Service
 * Platform-agnostic real-time message handling for all chat platforms
 * Ensures reliable real-user → Omni message display across all platforms
 */

class UniversalRealtimeService {
  constructor(io, dataStorage) {
    this.io = io;
    this.dataStorage = dataStorage;
    this.messageQueue = new Map(); // Store pending messages
    this.retryAttempts = new Map(); // Track retry attempts
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * UNIVERSAL: Process real-user message from any platform
   * This is the core function that handles all platforms
   */
  async processRealUserMessage(platform, messageData, conversationId) {
    try {
      console.log(`🌐 UNIVERSAL: Processing ${platform} real-user message`);
      console.log(`   Message: ${messageData.content}`);
      console.log(`   Conversation: ${conversationId}`);
      
      // Step 1: Store message immediately
      const storedMessage = await this.storeMessage(platform, messageData, conversationId);
      
      // Step 2: Emit real-time events with multiple strategies
      await this.emitRealtimeEvents(storedMessage, conversationId);
      
      // Step 3: Skip retry mechanism for speed
      // await this.ensureDelivery(storedMessage, conversationId);
      
      console.log(`✅ UNIVERSAL: ${platform} message processed successfully`);
      return { success: true, messageId: storedMessage.id };
      
    } catch (error) {
      console.error(`❌ UNIVERSAL: Failed to process ${platform} message:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * UNIVERSAL: Store message for any platform
   */
  async storeMessage(platform, messageData, conversationId) {
    // Create universal message format
    const universalMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversation_id: conversationId,
      platform: platform,
      sender_id: messageData.sender_id,
      sender_name: messageData.sender_name || this.getDefaultSenderName(platform, messageData.sender_id),
      sender_type: 'user',
      message_type: messageData.message_type || 'text',
      content: messageData.content,
      platform_message_id: messageData.platform_message_id,
      status: 'received',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      additional_data: messageData.additional_data ? JSON.stringify(messageData.additional_data) : null
    };

    // Store using dataStorageService (which handles both SQLite and JSON sync)
    try {
      const result = await this.dataStorage.saveMessage(universalMessage);
      console.log(`💾 UNIVERSAL: Message stored successfully: ${universalMessage.id}`);
      return universalMessage;
    } catch (error) {
      console.error('❌ UNIVERSAL: Message storage failed:', error.message);
      throw error;
    }
  }

  /**
   * UNIVERSAL: Emit real-time events with multiple strategies
   */
  async emitRealtimeEvents(message, conversationId) {
    console.log(`📡 UNIVERSAL: Emitting real-time events for message: ${message.id}`);
    
    // Get conversation data to include profile picture
    const fs = require('fs');
    const path = require('path');
    let profilePictureUrl = null;
    let userName = message.sender_name;
    
    try {
      const conversationsPath = path.join(__dirname, '../conversations.json');
      if (fs.existsSync(conversationsPath)) {
        const conversations = JSON.parse(fs.readFileSync(conversationsPath, 'utf8'));
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (conversation) {
          profilePictureUrl = conversation.profile_picture_url;
          userName = conversation.user_name || message.sender_name;
          console.log(`🖼️ UNIVERSAL: Found profile picture for conversation: ${profilePictureUrl ? 'Yes' : 'No'}`);
          console.log(`👤 UNIVERSAL: User name: ${userName}`);
          console.log(`🔗 UNIVERSAL: Profile picture URL: ${profilePictureUrl}`);
        }
      }
    } catch (error) {
      console.log('📁 UNIVERSAL: Could not read conversations.json for profile picture');
    }
    
    const eventData = {
      id: message.id,
      conversation_id: conversationId,
      sender_id: message.sender_id,
      sender_name: userName,
      sender_type: message.sender_type,
      message_type: message.message_type,
      content: message.content,
      platform: message.platform,
      status: message.status,
      created_at: message.created_at,
      timestamp: message.timestamp,
      sender: {
        id: message.sender_id,
        name: userName,
        platform: message.platform,
        profile_picture_url: profilePictureUrl
      }
    };

    // FAST: Only emit essential events for performance
    this.io.emit('new_message', eventData);
    this.io.to(conversationId).emit('new_message', eventData);

    console.log(`✅ UNIVERSAL: Emitted 2 essential events for fast performance`);
  }

  /**
   * UNIVERSAL: Ensure delivery with retry mechanism
   */
  async ensureDelivery(message, conversationId) {
    const messageId = message.id;
    
    // Add to retry queue
    this.messageQueue.set(messageId, {
      message: message,
      conversationId: conversationId,
      attempts: 0,
      lastAttempt: Date.now()
    });

    // Start retry mechanism
    setTimeout(() => {
      this.checkDeliveryStatus(messageId);
    }, this.retryDelay);
  }

  /**
   * UNIVERSAL: Check if message was delivered to frontend
   */
  async checkDeliveryStatus(messageId) {
    const queueItem = this.messageQueue.get(messageId);
    if (!queueItem) return;

    const { message, conversationId, attempts } = queueItem;
    
    if (attempts >= this.maxRetries) {
      console.log(`⚠️ UNIVERSAL: Max retries reached for message: ${messageId}`);
      this.messageQueue.delete(messageId);
      return;
    }

    // Increment attempts
    queueItem.attempts += 1;
    queueItem.lastAttempt = Date.now();

    console.log(`🔄 UNIVERSAL: Retry attempt ${attempts + 1} for message: ${messageId}`);
    
    // Re-emit events
    await this.emitRealtimeEvents(message, conversationId);

    // Schedule next retry
    setTimeout(() => {
      this.checkDeliveryStatus(messageId);
    }, this.retryDelay * (attempts + 1)); // Exponential backoff
  }

  /**
   * UNIVERSAL: Get default sender name for platform
   */
  getDefaultSenderName(platform, senderId) {
    const platformNames = {
      'line': `LINE User ${senderId.substring(0, 8)}`,
      'whatsapp': `WhatsApp User ${senderId.substring(0, 8)}`,
      'telegram': `Telegram User ${senderId.substring(0, 8)}`,
      'discord': `Discord User ${senderId.substring(0, 8)}`,
      'facebook': `Facebook User ${senderId.substring(0, 8)}`,
      'instagram': `Instagram User ${senderId.substring(0, 8)}`,
      'twitter': `Twitter User ${senderId.substring(0, 8)}`,
      'slack': `Slack User ${senderId.substring(0, 8)}`
    };
    
    return platformNames[platform] || `${platform.charAt(0).toUpperCase() + platform.slice(1)} User ${senderId.substring(0, 8)}`;
  }

  /**
   * UNIVERSAL: Mark message as delivered (called by frontend)
   */
  markMessageDelivered(messageId) {
    if (this.messageQueue.has(messageId)) {
      console.log(`✅ UNIVERSAL: Message delivered to frontend: ${messageId}`);
      this.messageQueue.delete(messageId);
    }
  }

  /**
   * UNIVERSAL: Get platform-specific webhook handler
   */
  getPlatformHandler(platform) {
    const handlers = {
      'line': require('./lineWebhookHandler'),
      'whatsapp': require('./whatsappWebhookHandler'),
      'telegram': require('./telegramWebhookHandler'),
      'discord': require('./discordWebhookHandler'),
      'facebook': require('./facebookWebhookHandler')
    };
    
    return handlers[platform] || null;
  }

  /**
   * UNIVERSAL: Process webhook for any platform
   */
  async processWebhook(platform, webhookData) {
    try {
      console.log(`🌐 UNIVERSAL: Processing ${platform} webhook`);
      
      const handler = this.getPlatformHandler(platform);
      if (!handler) {
        throw new Error(`No handler found for platform: ${platform}`);
      }

      // Process webhook using platform-specific handler
      const result = await handler.processWebhookEvents(webhookData.events, this.io);
      
      if (result.success) {
        console.log(`✅ UNIVERSAL: ${platform} webhook processed successfully`);
      } else {
        console.error(`❌ UNIVERSAL: ${platform} webhook failed:`, result.error);
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ UNIVERSAL: ${platform} webhook error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * UNIVERSAL: Get service statistics
   */
  getStats() {
    return {
      messageQueue: this.messageQueue.size,
      retryAttempts: Array.from(this.retryAttempts.values()),
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    };
  }
}

module.exports = UniversalRealtimeService;
