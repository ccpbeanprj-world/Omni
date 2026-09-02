// src/core/processors/LineProcessor.js
const logger = require('../../utils/logger');

class LineProcessor {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }

  // Process LINE message
  async process(messageData) {
    try {
      logger.info('🔄 Processing LINE message', {
        messageId: messageData.id,
        userId: messageData.from
      });

      // Step 1: Store or update user
      const user = await this.processUser(messageData);
      
      // Step 2: Store or update conversation
      const conversation = await this.processConversation(messageData, user);
      
      // Step 3: Store message
      const message = await this.processMessage(messageData, user, conversation);
      
      // Step 4: Update conversation last message
      await this.updateConversationLastMessage(conversation.id, message);
      
      logger.info('✅ LINE message processed successfully', {
        messageId: messageData.id,
        userId: user.id,
        conversationId: conversation.id
      });

      return {
        user,
        conversation,
        message
      };

    } catch (error) {
      logger.error('❌ LINE message processing failed:', {
        messageId: messageData.id,
        error: error.message
      });
      throw error;
    }
  }

  // Process user data
  async processUser(messageData) {
    const userData = {
      platform_id: messageData.from,
      platform: 'line',
      name: messageData.sender?.name || 'LINE User',
      metadata: {
        lastSeen: new Date().toISOString(),
        messageCount: 1,
        platform: 'line'
      }
    };

    return await this.databaseManager.storeUser(userData);
  }

  // Process conversation data
  async processConversation(messageData, user) {
    const conversationData = {
      user_id: user.id,
      platform: 'line',
      status: 'active'
    };

    return await this.databaseManager.storeConversation(conversationData);
  }

  // Process message data
  async processMessage(messageData, user, conversation) {
    const message = {
      id: messageData.id,
      conversationId: conversation.id,
      content: messageData.text || messageData.content || '',
      type: messageData.type || 'text',
      sender_type: messageData.sender_type || 'user',
      platform: 'line',
      timestamp: messageData.timestamp,
      created_at: messageData.created_at || new Date().toISOString()
    };

    return await this.databaseManager.storeMessage(message);
  }

  // Update conversation last message
  async updateConversationLastMessage(conversationId, message) {
    try {
      await this.databaseManager.query(`
        UPDATE conversations 
        SET last_message = $1, last_message_at = $2, updated_at = NOW()
        WHERE id = $3
      `, [
        message.content,
        message.created_at,
        conversationId
      ]);
    } catch (error) {
      logger.error('Failed to update conversation last message:', error);
    }
  }
}

module.exports = LineProcessor;
















