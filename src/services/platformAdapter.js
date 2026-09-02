class PlatformAdapter {
  constructor(platform, config) {
    this.platform = platform;
    this.config = config;
    this.webhookPath = config.webhookPath;
    this.apiBaseUrl = config.apiBaseUrl;
    this.messageTypes = config.messageTypes || ['text', 'image', 'file'];
  }

  // Detect platform from webhook data
  static detectPlatform(webhookData) {
    if (webhookData.events && webhookData.events[0]?.source?.userId) {
      return 'line';
    }
    if (webhookData.object === 'page' && webhookData.entry) {
      return 'facebook';
    }
    if (webhookData.update_id && webhookData.message) {
      return 'telegram';
    }
    if (webhookData.entry && webhookData.entry[0]?.changes) {
      return 'whatsapp';
    }
    return 'unknown';
  }

  // Process incoming webhook
  async processWebhook(webhookData) {
    const events = this.extractEvents(webhookData);
    const processedEvents = [];

    for (const event of events) {
      const processedEvent = await this.processEvent(event);
      if (processedEvent) {
        processedEvents.push(processedEvent);
      }
    }

    return processedEvents;
  }

  // Extract events from webhook data
  extractEvents(webhookData) {
    switch (this.platform) {
      case 'line':
        return webhookData.events || [];
      case 'facebook':
        return webhookData.entry?.flatMap(entry => entry.messaging) || [];
      case 'telegram':
        return webhookData.message ? [webhookData] : [];
      case 'whatsapp':
        return webhookData.entry?.flatMap(entry => 
          entry.changes?.flatMap(change => change.value?.messages || [])
        ) || [];
      default:
        return [];
    }
  }

  // Process individual event
  async processEvent(event) {
    const eventType = this.getEventType(event);
    
    switch (eventType) {
      case 'message':
        return await this.processMessageEvent(event);
      case 'follow':
        return await this.processFollowEvent(event);
      case 'unfollow':
        return await this.processUnfollowEvent(event);
      default:
        return null;
    }
  }

  // Get event type
  getEventType(event) {
    switch (this.platform) {
      case 'line':
        return event.type;
      case 'facebook':
        return event.message ? 'message' : 'postback';
      case 'telegram':
        return event.message ? 'message' : 'callback_query';
      case 'whatsapp':
        return event.type;
      default:
        return 'unknown';
    }
  }

  // Process message event
  async processMessageEvent(event) {
    const message = this.extractMessage(event);
    const user = this.extractUser(event);
    
    if (!message || !user) {
      return null;
    }

    return {
      type: 'message',
      platform: this.platform,
      userId: user.id,
      userName: user.name,
      userProfile: user.profile,
      messageId: message.id,
      messageType: message.type,
      content: message.content,
      timestamp: message.timestamp,
      additionalData: message.additionalData
    };
  }

  // Extract message from event
  extractMessage(event) {
    switch (this.platform) {
      case 'line':
        return {
          id: event.message?.id,
          type: event.message?.type,
          content: event.message?.text,
          timestamp: event.timestamp,
          additionalData: event.message
        };
      case 'facebook':
        return {
          id: event.message?.mid,
          type: 'text',
          content: event.message?.text,
          timestamp: event.timestamp,
          additionalData: event.message
        };
      case 'telegram':
        return {
          id: event.message?.message_id?.toString(),
          type: 'text',
          content: event.message?.text,
          timestamp: event.message?.date * 1000,
          additionalData: event.message
        };
      case 'whatsapp':
        return {
          id: event.id,
          type: event.type,
          content: event.text?.body,
          timestamp: event.timestamp,
          additionalData: event
        };
      default:
        return null;
    }
  }

  // Extract user from event
  extractUser(event) {
    switch (this.platform) {
      case 'line':
        return {
          id: event.source?.userId,
          name: event.source?.userId, // Will be updated with profile data
          profile: null
        };
      case 'facebook':
        return {
          id: event.sender?.id,
          name: event.sender?.id, // Will be updated with profile data
          profile: null
        };
      case 'telegram':
        return {
          id: event.message?.from?.id?.toString(),
          name: event.message?.from?.first_name,
          profile: event.message?.from
        };
      case 'whatsapp':
        return {
          id: event.from,
          name: event.from, // Will be updated with profile data
          profile: null
        };
      default:
        return null;
    }
  }

  // Send message to user
  async sendMessage(userId, message, messageType = 'text') {
    const payload = this.createMessagePayload(userId, message, messageType);
    
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Error sending ${this.platform} message:`, error.message);
      throw error;
    }
  }

  // Create message payload for platform
  createMessagePayload(userId, message, messageType) {
    switch (this.platform) {
      case 'line':
        return {
          to: userId,
          messages: [{
            type: messageType,
            text: message
          }]
        };
      case 'facebook':
        return {
          recipient: { id: userId },
          message: { text: message }
        };
      case 'telegram':
        return {
          chat_id: userId,
          text: message
        };
      case 'whatsapp':
        return {
          to: userId,
          type: messageType,
          text: { body: message }
        };
      default:
        return { to: userId, message: message };
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Error getting ${this.platform} user profile:`, error.message);
      return null;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(signature, body) {
    switch (this.platform) {
      case 'line':
        return this.verifyLineSignature(signature, body);
      case 'facebook':
        return this.verifyFacebookSignature(signature, body);
      case 'telegram':
        return this.verifyTelegramSignature(signature, body);
      case 'whatsapp':
        return this.verifyWhatsAppSignature(signature, body);
      default:
        return true; // Skip verification for unknown platforms
    }
  }

  // LINE signature verification
  verifyLineSignature(signature, body) {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', this.config.channelSecret)
      .update(body)
      .digest('base64');
    
    return signature === hash;
  }

  // Facebook signature verification
  verifyFacebookSignature(signature, body) {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha1', this.config.appSecret)
      .update(body)
      .digest('hex');
    
    return signature === `sha1=${hash}`;
  }

  // Telegram signature verification
  verifyTelegramSignature(signature, body) {
    // Telegram doesn't use signature verification
    return true;
  }

  // WhatsApp signature verification
  verifyWhatsAppSignature(signature, body) {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(body)
      .digest('hex');
    
    return signature === `sha256=${hash}`;
  }
}

module.exports = PlatformAdapter;






