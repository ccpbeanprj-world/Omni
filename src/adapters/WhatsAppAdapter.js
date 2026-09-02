const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');
const logger = require('../utils/logger');

class WhatsAppAdapter extends BaseAdapter {
  constructor(config) {
    super('whatsapp', {
      ...config,
      baseURL: `https://graph.facebook.com/${config.apiVersion || 'v18.0'}/${config.phoneNumberId}`
    });
    
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
    this.verifyToken = config.verifyToken;
    this.apiVersion = config.apiVersion || 'v18.0';
    
    // Set up axios instance with proper headers
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async sendMessage(conversationId, message) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: conversationId,
        type: 'text',
        text: {
          body: message.text || message.content
        }
      };

      const response = await this.httpClient.post('/messages', payload);
      
      logger.info('WhatsApp message sent successfully', {
        conversationId,
        messageId: response.data.messages[0].id,
        platform: 'whatsapp',
        phoneNumberId: this.phoneNumberId
      });

      return {
        success: true,
        messageId: response.data.messages[0].id,
        platform: 'whatsapp',
        conversationId: conversationId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp message', {
        error: error.message,
        conversationId,
        phoneNumberId: this.phoneNumberId,
        response: error.response?.data
      });
      throw error;
    }
  }

  async sendMedia(conversationId, mediaUrl, mediaType, caption = '') {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: conversationId,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          caption: caption
        }
      };

      const response = await this.makeRequest('POST', '/messages', payload);
      
      logger.info('WhatsApp media sent', {
        conversationId,
        mediaType,
        messageId: response.messages[0].id
      });

      return {
        success: true,
        messageId: response.messages[0].id,
        platform: 'whatsapp'
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp media', error);
      throw error;
    }
  }

  async markAsRead(conversationId, messageId) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      };

      await this.makeRequest('POST', '/messages', payload);
      
      logger.info('WhatsApp message marked as read', {
        conversationId,
        messageId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to mark WhatsApp message as read', error);
      throw error;
    }
  }

  async getProfile(phoneNumber) {
    try {
      const response = await this.makeRequest('GET', `/${phoneNumber}`);
      
      return {
        id: phoneNumber,
        name: response.name,
        profile_picture_url: response.profile_picture_url,
        platform: 'whatsapp'
      };
    } catch (error) {
      logger.error('Failed to get WhatsApp profile', error);
      throw error;
    }
  }

  async validateWebhook(payload, signature) {
    // WhatsApp webhook validation
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.verifyToken)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === expectedSignature;
  }

  async processWebhook(payload) {
    try {
      const entries = payload.entry || [];
      const messages = [];

      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          if (change.field === 'messages') {
            const value = change.value;
            
            if (value.messages) {
              for (const message of value.messages) {
                const processedMessage = {
                  id: message.id,
                  from: message.from,
                  timestamp: message.timestamp,
                  type: message.type,
                  text: message.text?.body || '',
                  media: message.image || message.video || message.audio || message.document,
                  platform: 'whatsapp',
                  conversationId: message.from
                };

                messages.push(processedMessage);
              }
            }

            // Handle status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                const statusMessage = {
                  id: status.id,
                  from: status.recipient_id,
                  timestamp: status.timestamp,
                  type: 'status',
                  status: status.status,
                  platform: 'whatsapp',
                  conversationId: status.recipient_id
                };

                messages.push(statusMessage);
              }
            }
          }
        }
      }

      logger.info('WhatsApp webhook processed', {
        messageCount: messages.length
      });

      return messages;
    } catch (error) {
      logger.error('Failed to process WhatsApp webhook', error);
      throw error;
    }
  }

  // WhatsApp specific methods
  async sendTemplate(templateName, languageCode, conversationId, components = []) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: conversationId,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: components
        }
      };

      const response = await this.makeRequest('POST', '/messages', payload);
      
      logger.info('WhatsApp template sent', {
        conversationId,
        templateName,
        messageId: response.messages[0].id
      });

      return {
        success: true,
        messageId: response.messages[0].id,
        platform: 'whatsapp'
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp template', error);
      throw error;
    }
  }

  async sendInteractiveMessage(conversationId, interactiveData) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: conversationId,
        type: 'interactive',
        interactive: interactiveData
      };

      const response = await this.makeRequest('POST', '/messages', payload);
      
      logger.info('WhatsApp interactive message sent', {
        conversationId,
        messageId: response.messages[0].id
      });

      return {
        success: true,
        messageId: response.messages[0].id,
        platform: 'whatsapp'
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp interactive message', error);
      throw error;
    }
  }
}

module.exports = WhatsAppAdapter;







