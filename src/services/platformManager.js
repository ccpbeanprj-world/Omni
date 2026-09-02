// Base Platform Adapter Interface
class BasePlatformAdapter {
  constructor(platform, config) {
    this.platform = platform;
    this.config = config;
    this.isActive = config.enabled || false;
  }

  // Abstract methods that must be implemented by each platform
  async sendMessage(userId, message, options = {}) {
    throw new Error(`sendMessage not implemented for ${this.platform}`);
  }

  async getUserProfile(userId) {
    throw new Error(`getUserProfile not implemented for ${this.platform}`);
  }

  async handleWebhook(payload) {
    throw new Error(`handleWebhook not implemented for ${this.platform}`);
  }

  async validateWebhook(payload, signature) {
    throw new Error(`validateWebhook not implemented for ${this.platform}`);
  }

  // Common utility methods
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeMessage(message) {
    // Basic message sanitization
    return message.replace(/[<>]/g, '');
  }

  formatMessageForPlatform(message, messageType = 'text') {
    return {
      type: messageType,
      content: this.sanitizeMessage(message),
      timestamp: new Date().toISOString()
    };
  }
}

// LINE Platform Adapter
class LineAdapter extends BasePlatformAdapter {
  constructor(config) {
    super('line', config);
    this.apiUrl = config.api_url || 'https://api.line.me/v2/bot';
    this.accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    this.channelSecret = process.env.LINE_CHANNEL_SECRET;
  }

  async sendMessage(userId, message, options = {}) {
    if (!this.accessToken) {
      throw new Error('LINE access token not configured');
    }

    const axios = require('axios');
    const messageData = this.formatMessageForPlatform(message, options.messageType);

    try {
      const response = await axios.post(`${this.apiUrl}/message/push`, {
        to: userId,
        messages: [{
          type: messageData.type,
          text: messageData.content
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return {
        success: true,
        messageId: response.data.messageId,
        platform: this.platform,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ LINE send message failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        platform: this.platform
      };
    }
  }

  async getUserProfile(userId) {
    if (!this.accessToken) {
      throw new Error('LINE access token not configured');
    }

    const axios = require('axios');

    try {
      const response = await axios.get(`${this.apiUrl}/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        timeout: 5000
      });

      return {
        success: true,
        data: {
          userId: userId,
          displayName: response.data.displayName,
          pictureUrl: response.data.pictureUrl,
          statusMessage: response.data.statusMessage
        }
      };
    } catch (error) {
      console.error(`❌ LINE get profile failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  async handleWebhook(payload) {
    const events = payload.events || [];
    const processedMessages = [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const message = {
          id: this.generateMessageId(),
          platform: this.platform,
          platformMessageId: event.message.id,
          senderId: event.source.userId,
          content: event.message.text,
          messageType: event.message.type,
          timestamp: new Date().toISOString(),
          replyToken: event.replyToken
        };

        processedMessages.push(message);
      }
    }

    return processedMessages;
  }

  async validateWebhook(payload, signature) {
    const crypto = require('crypto');
    const body = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', this.channelSecret).update(body).digest('base64');
    
    return hash === signature;
  }
}

// WhatsApp Platform Adapter
class WhatsAppAdapter extends BasePlatformAdapter {
  constructor(config) {
    super('whatsapp', config);
    this.apiUrl = config.api_url || 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  }

  async sendMessage(userId, message, options = {}) {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp access token or phone number ID not configured');
    }

    const axios = require('axios');
    const messageData = this.formatMessageForPlatform(message, options.messageType);

    try {
      const response = await axios.post(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: userId,
        type: messageData.type,
        text: { body: messageData.content }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return {
        success: true,
        messageId: response.data.messages[0].id,
        platform: this.platform,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ WhatsApp send message failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        platform: this.platform
      };
    }
  }

  async getUserProfile(userId) {
    // WhatsApp doesn't provide user profile API
    return {
      success: true,
      data: {
        userId: userId,
        displayName: `WhatsApp User ${userId.substring(0, 8)}`,
        pictureUrl: null,
        statusMessage: ''
      }
    };
  }

  async handleWebhook(payload) {
    const entries = payload.entry || [];
    const processedMessages = [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const messages = change.value?.messages || [];
        for (const message of messages) {
          if (message.type === 'text') {
            const processedMessage = {
              id: this.generateMessageId(),
              platform: this.platform,
              platformMessageId: message.id,
              senderId: message.from,
              content: message.text.body,
              messageType: message.type,
              timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString()
            };

            processedMessages.push(processedMessage);
          }
        }
      }
    }

    return processedMessages;
  }

  async validateWebhook(payload, signature) {
    // WhatsApp webhook validation
    const crypto = require('crypto');
    const body = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', this.verifyToken).update(body).digest('hex');
    
    return hash === signature;
  }
}

// Facebook Messenger Platform Adapter
class FacebookAdapter extends BasePlatformAdapter {
  constructor(config) {
    super('facebook', config);
    this.apiUrl = config.api_url || 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.appSecret = process.env.FACEBOOK_APP_SECRET;
    this.verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;
  }

  async sendMessage(userId, message, options = {}) {
    if (!this.accessToken) {
      throw new Error('Facebook access token not configured');
    }

    const axios = require('axios');
    const messageData = this.formatMessageForPlatform(message, options.messageType);

    try {
      const response = await axios.post(`${this.apiUrl}/me/messages`, {
        recipient: { id: userId },
        message: { text: messageData.content }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return {
        success: true,
        messageId: response.data.message_id,
        platform: this.platform,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Facebook send message failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        platform: this.platform
      };
    }
  }

  async getUserProfile(userId) {
    if (!this.accessToken) {
      throw new Error('Facebook access token not configured');
    }

    const axios = require('axios');

    try {
      const response = await axios.get(`${this.apiUrl}/${userId}`, {
        params: {
          fields: 'first_name,last_name,profile_pic'
        },
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        timeout: 5000
      });

      return {
        success: true,
        data: {
          userId: userId,
          displayName: `${response.data.first_name} ${response.data.last_name}`,
          pictureUrl: response.data.profile_pic,
          statusMessage: ''
        }
      };
    } catch (error) {
      console.error(`❌ Facebook get profile failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  async handleWebhook(payload) {
    const entries = payload.entry || [];
    const processedMessages = [];

    for (const entry of entries) {
      const messaging = entry.messaging || [];
      for (const event of messaging) {
        if (event.message && event.message.text) {
          const message = {
            id: this.generateMessageId(),
            platform: this.platform,
            platformMessageId: event.message.mid,
            senderId: event.sender.id,
            content: event.message.text,
            messageType: 'text',
            timestamp: new Date(event.timestamp).toISOString()
          };

          processedMessages.push(message);
        }
      }
    }

    return processedMessages;
  }

  async validateWebhook(payload, signature) {
    // Facebook webhook validation
    const crypto = require('crypto');
    const body = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', this.appSecret).update(body).digest('hex');
    
    return hash === signature;
  }
}

// WeChat Platform Adapter
class WeChatAdapter extends BasePlatformAdapter {
  constructor(config) {
    super('wechat', config);
    this.apiUrl = config.api_url || 'https://api.weixin.qq.com';
    this.appId = process.env.WECHAT_APP_ID;
    this.appSecret = process.env.WECHAT_APP_SECRET;
    this.token = process.env.WECHAT_TOKEN;
  }

  async sendMessage(userId, message, options = {}) {
    // WeChat requires access token refresh
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('WeChat access token not available');
    }

    const axios = require('axios');
    const messageData = this.formatMessageForPlatform(message, options.messageType);

    try {
      const response = await axios.post(`${this.apiUrl}/cgi-bin/message/custom/send`, {
        touser: userId,
        msgtype: 'text',
        text: { content: messageData.content }
      }, {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return {
        success: true,
        messageId: response.data.msgid,
        platform: this.platform,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ WeChat send message failed:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        platform: this.platform
      };
    }
  }

  async getUserProfile(userId) {
    // WeChat doesn't provide user profile API for public accounts
    return {
      success: true,
      data: {
        userId: userId,
        displayName: `WeChat User ${userId.substring(0, 8)}`,
        pictureUrl: null,
        statusMessage: ''
      }
    };
  }

  async handleWebhook(payload) {
    // WeChat webhook handling (XML format)
    const processedMessages = [];
    
    if (payload.MsgType === 'text') {
      const message = {
        id: this.generateMessageId(),
        platform: this.platform,
        platformMessageId: payload.MsgId,
        senderId: payload.FromUserName,
        content: payload.Content,
        messageType: 'text',
        timestamp: new Date(parseInt(payload.CreateTime) * 1000).toISOString()
      };

      processedMessages.push(message);
    }

    return processedMessages;
  }

  async validateWebhook(payload, signature) {
    // WeChat webhook validation
    const crypto = require('crypto');
    const timestamp = payload.timestamp;
    const nonce = payload.nonce;
    const echostr = payload.echostr;
    
    const tmpArr = [this.token, timestamp, nonce].sort();
    const tmpStr = tmpArr.join('');
    const hash = crypto.createHash('sha1').update(tmpStr).digest('hex');
    
    return hash === signature;
  }

  async getAccessToken() {
    const axios = require('axios');
    
    try {
      const response = await axios.get(`${this.apiUrl}/cgi-bin/token`, {
        params: {
          grant_type: 'client_credential',
          appid: this.appId,
          secret: this.appSecret
        },
        timeout: 5000
      });

      return response.data.access_token;
    } catch (error) {
      console.error('❌ WeChat access token failed:', error.message);
      return null;
    }
  }
}

// Platform Adapter Manager
class PlatformAdapterManager {
  constructor() {
    this.adapters = new Map();
    this.initializeAdapters();
  }

  initializeAdapters() {
    // Initialize LINE adapter
    this.adapters.set('line', new LineAdapter({
      api_url: 'https://api.line.me/v2/bot',
      webhook_url: '/webhook/line',
      enabled: true
    }));

    // Initialize WhatsApp adapter
    this.adapters.set('whatsapp', new WhatsAppAdapter({
      api_url: 'https://graph.facebook.com/v18.0',
      webhook_url: '/webhook/whatsapp',
      enabled: false // Will be enabled when configured
    }));

    // Initialize Facebook adapter
    this.adapters.set('facebook', new FacebookAdapter({
      api_url: 'https://graph.facebook.com/v18.0',
      webhook_url: '/webhook/facebook',
      enabled: false // Will be enabled when configured
    }));

    // Initialize WeChat adapter
    this.adapters.set('wechat', new WeChatAdapter({
      api_url: 'https://api.weixin.qq.com',
      webhook_url: '/webhook/wechat',
      enabled: false // Will be enabled when configured
    }));
  }

  getAdapter(platform) {
    return this.adapters.get(platform);
  }

  getAllAdapters() {
    return Array.from(this.adapters.values());
  }

  getActiveAdapters() {
    return this.getAllAdapters().filter(adapter => adapter.isActive);
  }

  async sendMessage(platform, userId, message, options = {}) {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform adapter not found: ${platform}`);
    }

    if (!adapter.isActive) {
      throw new Error(`Platform adapter not active: ${platform}`);
    }

    return await adapter.sendMessage(userId, message, options);
  }

  async getUserProfile(platform, userId) {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform adapter not found: ${platform}`);
    }

    return await adapter.getUserProfile(userId);
  }

  async handleWebhook(platform, payload, signature) {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform adapter not found: ${platform}`);
    }

    // Validate webhook signature
    const isValid = await adapter.validateWebhook(payload, signature);
    if (!isValid) {
      throw new Error(`Invalid webhook signature for ${platform}`);
    }

    return await adapter.handleWebhook(payload);
  }
}

module.exports = {
  BasePlatformAdapter,
  LineAdapter,
  WhatsAppAdapter,
  FacebookAdapter,
  WeChatAdapter,
  PlatformAdapterManager
};





