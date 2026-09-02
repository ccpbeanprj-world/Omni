#!/usr/bin/env node

/**
 * Clean LINE Webhook Handler
 * Fixes webhook payload parsing and ensures real-time message sync
 */

require('dotenv').config();
const crypto = require('crypto');

class CleanLineWebhookHandler {
  constructor() {
    this.lineChannelSecret = process.env.LINE_CHANNEL_SECRET;
    this.lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  }

  /**
   * Verify webhook signature with proper error handling
   */
  verifyWebhookSignature(body, signature) {
    try {
      if (!this.lineChannelSecret) {
        console.error('❌ LINE_CHANNEL_SECRET not configured');
        return false;
      }
      
      if (!signature) {
        console.error('❌ No signature provided');
        return false;
      }
      
      const hash = crypto
        .createHmac('SHA256', this.lineChannelSecret)
        .update(body)
        .digest('base64');
      
      const isValid = hash === signature;
      
      if (!isValid) {
        console.error('❌ Signature verification failed');
        console.error(`   Expected: ${hash}`);
        console.error(`   Received: ${signature}`);
        console.error(`   Body length: ${body.length}`);
      } else {
        console.log('✅ Signature verification successful');
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Process webhook events and handle messages with Socket.IO real-time updates
   */
  async processWebhookEvents(events, io = null) {
    try {
      console.log(`📨 Processing ${events.length} webhook events...`);
      
      for (const event of events) {
        console.log(`   Event type: ${event.type}`);
        console.log(`   User ID: ${event.source?.userId || 'Unknown'}`);
        
        if (event.type === 'message' && event.source?.userId) {
          await this.handleMessageEvent(event, io);
        }
      }
      
      return { success: true, eventsProcessed: events.length };
    } catch (error) {
      console.error('❌ Failed to process webhook events:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle message events with Socket.IO real-time updates
   */
  async handleMessageEvent(event, io = null) {
    try {
      const userId = event.source.userId;
      const messageText = event.message?.text || '';
      const replyToken = event.replyToken;
      
      console.log(`💬 Handling message from ${userId}: ${messageText}`);
      
      // Create or update user with display name
      const displayName = event.source?.displayName;
      await this.createOrUpdateUser(userId, displayName);
      
      // Create or update conversation
      await this.createOrUpdateConversation(userId, io);
      
      // Store message with Socket.IO real-time updates
      await this.storeMessage(userId, messageText, 'user', io);
      
      // Auto-reply disabled - comment out the auto-reply call
      // await this.sendAutoReply(userId, messageText, replyToken);
      
      console.log(`✅ Message processed successfully for ${userId} (Auto-reply disabled)`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to handle message event:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create or update user with dynamic user ID capture
   */
  async createOrUpdateUser(userId, displayName = null) {
    try {
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
      
      const fs = require('fs');
      const path = require('path');
      let users = [];
      
      try {
        users = JSON.parse(fs.readFileSync(path.join(__dirname, '../users.json'), 'utf8'));
      } catch (error) {
        console.log('   Creating new users.json file');
      }
      
      let user = users.find(u => u.platform_user_id === userId);
      
      if (!user) {
        console.log(`   Creating new user: ${userId}`);
        console.log(`   Display Name: ${displayName || 'Not provided'}`);
        
        // Capture real user ID dynamically
        this.captureRealUserId(userId, displayName);
        
        // Try to get real LINE user profile with caching
        let profile = null;
        try {
          profile = await this.getLineUserProfile(userId);
          console.log(`   ✅ Fetched real LINE profile: ${profile.displayName}`);
        } catch (error) {
          console.log(`   ⚠️ Using fallback profile data`);
        }
        
        user = {
          id: `user_line_${userId}`,
          name: profile?.displayName || displayName || `LINE User ${userId.substring(0, 8)}`,
          display_name: profile?.displayName || displayName || `LINE User ${userId.substring(0, 8)}`,
          platform: 'line',
          platform_user_id: userId,
          profile_picture_url: profile?.pictureUrl || null,
          status_message: profile?.statusMessage || '',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          additionalData: {
            is_real_line_user: true,
            real_user_id: userId,
            status_message: '',
            language: 'en'
          }
        };
        
        users.push(user);
        console.log(`   ✅ Created user: ${user.name}`);
      } else {
        console.log(`   ✅ User exists: ${user.name}`);
        user.last_seen = new Date().toISOString();
        user.updated_at = new Date().toISOString();
        
        // Update display name if provided
        if (displayName && !user.name.includes('LINE User')) {
          user.name = displayName;
          user.display_name = displayName;
        }
      }
      
      fs.writeFileSync(path.join(__dirname, '../users.json'), JSON.stringify(users, null, 2));
      return user;
    } catch (error) {
      console.error('❌ Failed to create/update user:', error);
      return null;
    }
  }

  /**
   * Get real user data from users.json
   */
  async getRealUserData(userId) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      try {
        const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../users.json'), 'utf8'));
        const user = users.find(u => u.platform_user_id === userId);
        
        if (user) {
          return {
            displayName: user.display_name || user.name,
            profilePictureUrl: user.profile_picture_url
          };
        }
      } catch (error) {
        console.log('   No users.json file found');
      }
      
      // Fallback: try to get LINE profile
      try {
        const profile = await this.getLineUserProfile(userId);
        return {
          displayName: profile.displayName,
          profilePictureUrl: profile.pictureUrl
        };
      } catch (error) {
        console.log('   Could not fetch LINE profile');
      }
      
      return {
        displayName: null,
        profilePictureUrl: null
      };
    } catch (error) {
      console.error('❌ Failed to get real user data:', error);
      return {
        displayName: null,
        profilePictureUrl: null
      };
    }
  }

  /**
   * Capture real user ID dynamically
   */
  captureRealUserId(realUserId, displayName = null) {
    try {
      const fs = require('fs');
      const userMappingFile = 'line-user-id-mapping.json';
      
      // Load existing mapping
      let userMapping = {};
      if (fs.existsSync(userMappingFile)) {
        userMapping = JSON.parse(fs.readFileSync(userMappingFile, 'utf8'));
      }
      
      const mappingKey = `user_${realUserId}`;
      
      if (!userMapping[mappingKey]) {
        userMapping[mappingKey] = {
          realUserId: realUserId,
          displayName: displayName || `LINE User ${realUserId.substring(0, 8)}`,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          messageCount: 0,
          platform: 'line'
        };
        console.log(`✅ Captured new real user ID: ${displayName || 'Unknown'} (${realUserId})`);
      } else {
        userMapping[mappingKey].lastSeen = new Date().toISOString();
        userMapping[mappingKey].messageCount += 1;
        if (displayName && !userMapping[mappingKey].displayName.includes('LINE User')) {
          userMapping[mappingKey].displayName = displayName;
        }
        console.log(`🔄 Updated real user ID: ${userMapping[mappingKey].displayName}`);
      }
      
      // Save mapping
      fs.writeFileSync(userMappingFile, JSON.stringify(userMapping, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to capture real user ID:', error);
    }
  }

  /**
   * Create or update conversation with WebSocket real-time updates
   */
  async createOrUpdateConversation(userId, io = null) {
    try {
      const fs = require('fs');
      let conversations = [];
      
      try {
        conversations = JSON.parse(fs.readFileSync('conversations.json', 'utf8'));
      } catch (error) {
        console.log('   Creating new conversations.json file');
      }
      
      let conversation = conversations.find(c => c.platform_user_id === userId);
      let isNewConversation = false;
      
      // Get real user data for conversation
      const realUser = await this.getRealUserData(userId);
      
      if (!conversation) {
        console.log(`   Creating new conversation for user: ${userId}`);
        isNewConversation = true;
        
        conversation = {
          id: `conv_line_${userId}`,
          user_id: `user_line_${userId}`,
          platform: 'line',
          platform_conversation_id: userId,
          platform_user_id: userId,
          status: 'active',
          user_name: realUser.displayName || `LINE User ${userId.substring(0, 8)}`,
          profile_picture_url: realUser.profilePictureUrl || null,
          last_message: '',
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message_count: 0
        };
        
        conversations.push(conversation);
        console.log(`   ✅ Created conversation: ${conversation.id} with real user data: ${conversation.user_name}`);
      } else {
        console.log(`   ✅ Conversation exists: ${conversation.id}`);
        conversation.updated_at = new Date().toISOString();
        
        // Update with real user data if available
        if (realUser.displayName && !conversation.user_name.includes('LINE User')) {
          conversation.user_name = realUser.displayName;
        }
        if (realUser.profilePictureUrl) {
          conversation.profile_picture_url = realUser.profilePictureUrl;
        }
      }
      
      fs.writeFileSync('conversations.json', JSON.stringify(conversations, null, 2));
      
      // Emit WebSocket events for real-time updates
      if (io) {
        if (isNewConversation) {
          console.log(`📡 Emitting conversation_created event for: ${conversation.id}`);
          io.emit('conversation_created', conversation);
        } else {
          console.log(`📡 Emitting conversation_updated event for: ${conversation.id}`);
          io.emit('conversation_updated', conversation);
        }
      }
      
      return conversation;
    } catch (error) {
      console.error('❌ Failed to create/update conversation:', error);
      return null;
    }
  }

  /**
   * Store message with Socket.IO real-time updates
   */
  async storeMessage(userId, messageText, senderType, io = null) {
    try {
      const fs = require('fs');
      let messages = [];
      
      try {
        messages = JSON.parse(fs.readFileSync('messages.json', 'utf8'));
      } catch (error) {
        console.log('   Creating new messages.json file');
      }
      
      // Get real LINE user profile for accurate name
      let senderName = senderType === 'user' ? `LINE User ${userId.substring(0, 8)}` : 'Omni Agent';
      
      if (senderType === 'user') {
        try {
          const profile = await this.getLineUserProfile(userId);
          if (profile && profile.displayName) {
            senderName = profile.displayName;
          }
        } catch (error) {
          console.log(`   ⚠️ Could not get LINE profile, using fallback name`);
        }
      }

      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conversation_id: `conv_line_${userId}`,
        sender_id: senderType === 'user' ? `user_line_${userId}` : 'omni_agent',
        sender_name: senderName,
        sender_type: senderType,
        content: messageText,
        message_type: 'text',
        platform: 'line',
        status: 'delivered',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      messages.push(message);
      fs.writeFileSync('messages.json', JSON.stringify(messages, null, 2));
      
      console.log(`   ✅ Stored message: ${message.id}`);
      
      // Emit real-time Socket.IO events if available
      if (io) {
        const conversationId = `conv_line_${userId}`;
        
        // Find or create conversation for real-time update
        let conversations = [];
        try {
          conversations = JSON.parse(fs.readFileSync('conversations.json', 'utf8'));
        } catch (error) {
          console.log('   Creating new conversations.json file');
        }
        
        let conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) {
          // Get real LINE profile for conversation creation
          let realUserName = `LINE User ${userId.substring(0, 8)}`;
          let realProfilePicture = null;
          
          try {
            const profile = await this.getLineUserProfile(userId);
            if (profile && profile.displayName) {
              realUserName = profile.displayName;
              realProfilePicture = profile.pictureUrl;
              console.log(`   ✅ Using real LINE profile: ${realUserName}`);
            }
          } catch (error) {
            console.log(`   ⚠️ Using fallback name for conversation`);
          }
          
          conversation = {
            id: conversationId,
            platform: 'line',
            platform_user_id: userId,
            user_name: realUserName,
            profile_picture_url: realProfilePicture,
            last_message: messageText,
            last_message_at: message.timestamp,
            status: 'pending',
            message_count: 1,
            created_at: message.timestamp,
            updated_at: message.timestamp
          };
          conversations.push(conversation);
          fs.writeFileSync('conversations.json', JSON.stringify(conversations, null, 2));
        } else {
          conversation.last_message = messageText;
          conversation.last_message_at = message.timestamp;
          conversation.updated_at = message.timestamp;
          conversation.message_count = (conversation.message_count || 0) + 1;
          fs.writeFileSync('conversations.json', JSON.stringify(conversations, null, 2));
        }
        
        // Emit real-time events with correct data structure
        const messageData = {
          id: message.id,
          conversation_id: conversationId,
          sender_id: message.sender_id,
          sender_name: message.sender_name,
          sender_type: message.sender_type,
          message_type: message.message_type,
          content: message.content,
          platform: message.platform,
          status: message.status,
          created_at: message.created_at,
          timestamp: message.timestamp
        };
        
        io.emit('new_message', messageData);
        io.to(conversationId).emit('message_received', messageData);
        
        console.log(`   🔄 Real-time events emitted for conversation ${conversationId}`);
      }
      
      return message;
    } catch (error) {
      console.error('❌ Failed to store message:', error);
      return null;
    }
  }

  /**
   * Get LINE user profile
   */
  async getLineUserProfile(userId) {
    try {
      if (!this.lineChannelAccessToken) {
        return {
          success: false,
          displayName: `LINE User ${userId.substring(0, 8)}`,
          pictureUrl: null, // Don't use DiceBear as fallback
          statusMessage: '',
          language: 'en'
        };
      }
      
      const axios = require('axios');
      const response = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.lineChannelAccessToken}`
        }
      });
      
      return {
        success: true,
        displayName: response.data.displayName,
        pictureUrl: response.data.pictureUrl,
        statusMessage: response.data.statusMessage || '',
        language: response.data.language || 'en'
      };
    } catch (error) {
      console.log(`   ⚠️ Failed to fetch LINE profile: ${error.response?.status}`);
      return {
        success: false,
        displayName: `LINE User ${userId.substring(0, 8)}`,
        pictureUrl: null, // Don't use DiceBear as fallback
        statusMessage: '',
        language: 'en'
      };
    }
  }

  /**
   * Get user mapping by real user ID
   */
  getUserMapping(realUserId) {
    try {
      const fs = require('fs');
      const userMappingFile = 'line-user-id-mapping.json';
      
      if (fs.existsSync(userMappingFile)) {
        const userMapping = JSON.parse(fs.readFileSync(userMappingFile, 'utf8'));
        const mappingKey = `user_${realUserId}`;
        return userMapping[mappingKey] || null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get user mapping:', error);
      return null;
    }
  }

  /**
   * Send auto-reply
   */
  async sendAutoReply(userId, messageText, replyToken) {
    try {
      if (!this.lineChannelAccessToken) {
        console.log('   ⚠️ LINE_CHANNEL_ACCESS_TOKEN not set, skipping auto-reply');
        return;
      }
      
      const axios = require('axios');
      
      // Get user display name dynamically
      const userMapping = this.getUserMapping(userId);
      const displayName = userMapping?.displayName || `LINE User ${userId.substring(0, 8)}`;
      
      const replyMessage = `Hello ${displayName}! I received your message: "${messageText}". This is an auto-reply from Omni Platform.`;
      
      const response = await axios.post('https://api.line.me/v2/bot/message/reply', {
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: replyMessage
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${this.lineChannelAccessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   ✅ Auto-reply sent: ${replyMessage}`);
      
      // Store the auto-reply message
      await this.storeMessage(userId, replyMessage, 'agent');
      
      return { success: true };
    } catch (error) {
      console.log(`   ⚠️ Failed to send auto-reply: ${error.response?.status}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send message to LINE user with Socket.IO real-time updates
   */
  async sendMessageToLineUser(userId, message, io = null) {
    try {
      if (!this.lineChannelAccessToken) {
        console.log('   ⚠️ LINE_CHANNEL_ACCESS_TOKEN not set, cannot send message');
        return { success: false, error: 'No access token' };
      }
      
      const axios = require('axios');
      
      const response = await axios.post('https://api.line.me/v2/bot/message/push', {
        to: userId,
        messages: [{
          type: 'text',
          text: message
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${this.lineChannelAccessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   ✅ Message sent to LINE user ${userId}: ${message}`);
      
      // Store the message with Socket.IO real-time updates
      await this.storeMessage(userId, message, 'agent', io);
      
      return { success: true, messageId: response.data.messageId };
    } catch (error) {
      console.log(`   ❌ Failed to send message to LINE user: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = CleanLineWebhookHandler;