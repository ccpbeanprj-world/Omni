const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class ThreadsAdapter extends BaseAdapter {
  constructor(config) {
    super('threads', {
      ...config,
      baseURL: 'https://graph.facebook.com/v18.0'
    });
    
    this.pageId = config.pageId;
    this.verifyToken = config.verifyToken;
  }

  async sendMessage(conversationId, message) {
    try {
      const payload = {
        recipient: {
          id: conversationId
        },
        message: {
          text: message.text
        }
      };

      const response = await this.makeRequest('POST', `/me/messages`, payload);
      
      logger.info('Threads message sent', {
        conversationId,
        messageId: response.message_id
      });

      return {
        success: true,
        messageId: response.message_id,
        platform: 'threads'
      };
    } catch (error) {
      logger.error('Failed to send Threads message', error);
      throw error;
    }
  }

  async sendMedia(conversationId, mediaUrl, mediaType, caption = '') {
    try {
      let messagePayload;

      switch (mediaType) {
        case 'image':
          messagePayload = {
            attachment: {
              type: 'image',
              payload: {
                url: mediaUrl
              }
            }
          };
          break;
        case 'video':
          messagePayload = {
            attachment: {
              type: 'video',
              payload: {
                url: mediaUrl
              }
            }
          };
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      const payload = {
        recipient: {
          id: conversationId
        },
        message: messagePayload
      };

      const response = await this.makeRequest('POST', `/me/messages`, payload);
      
      logger.info('Threads media sent', {
        conversationId,
        mediaType,
        messageId: response.message_id
      });

      return {
        success: true,
        messageId: response.message_id,
        platform: 'threads'
      };
    } catch (error) {
      logger.error('Failed to send Threads media', error);
      throw error;
    }
  }

  async markAsRead(conversationId, messageId) {
    try {
      const payload = {
        recipient: {
          id: conversationId
        },
        sender_action: 'mark_seen'
      };

      await this.makeRequest('POST', `/me/messages`, payload);
      
      logger.info('Threads message marked as read', {
        conversationId,
        messageId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to mark Threads message as read', error);
      throw error;
    }
  }

  async getProfile(userId) {
    try {
      const response = await this.makeRequest('GET', `/${userId}`, null, {
        fields: 'first_name,last_name,profile_pic'
      });
      
      return {
        id: userId,
        name: `${response.first_name} ${response.last_name}`.trim(),
        profile_picture_url: response.profile_pic,
        platform: 'threads'
      };
    } catch (error) {
      logger.error('Failed to get Threads profile', error);
      throw error;
    }
  }

  async validateWebhook(payload, signature) {
    // Threads uses same webhook validation as Facebook
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
        const messaging = entry.messaging || [];
        
        for (const event of messaging) {
          if (event.message) {
            const message = event.message;
            const processedMessage = {
              id: message.mid,
              from: event.sender.id,
              timestamp: event.timestamp,
              type: 'text',
              text: message.text || '',
              attachments: message.attachments || [],
              platform: 'threads',
              conversationId: event.sender.id
            };

            messages.push(processedMessage);
          }

          if (event.postback) {
            const postback = event.postback;
            const processedMessage = {
              id: `postback_${event.timestamp}`,
              from: event.sender.id,
              timestamp: event.timestamp,
              type: 'postback',
              text: postback.title,
              payload: postback.payload,
              platform: 'threads',
              conversationId: event.sender.id
            };

            messages.push(processedMessage);
          }
        }
      }

      logger.info('Threads webhook processed', {
        messageCount: messages.length
      });

      return messages;
    } catch (error) {
      logger.error('Failed to process Threads webhook', error);
      throw error;
    }
  }
}

module.exports = ThreadsAdapter;








