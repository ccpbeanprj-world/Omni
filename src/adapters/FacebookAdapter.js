const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class FacebookAdapter extends BaseAdapter {
  constructor(config) {
    super('facebook', {
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
      
      logger.info('Facebook message sent', {
        conversationId,
        messageId: response.message_id
      });

      return {
        success: true,
        messageId: response.message_id,
        platform: 'facebook'
      };
    } catch (error) {
      logger.error('Failed to send Facebook message', error);
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
        case 'audio':
          messagePayload = {
            attachment: {
              type: 'audio',
              payload: {
                url: mediaUrl
              }
            }
          };
          break;
        case 'file':
          messagePayload = {
            attachment: {
              type: 'file',
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
      
      logger.info('Facebook media sent', {
        conversationId,
        mediaType,
        messageId: response.message_id
      });

      return {
        success: true,
        messageId: response.message_id,
        platform: 'facebook'
      };
    } catch (error) {
      logger.error('Failed to send Facebook media', error);
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
      
      logger.info('Facebook message marked as read', {
        conversationId,
        messageId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to mark Facebook message as read', error);
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
        platform: 'facebook'
      };
    } catch (error) {
      logger.error('Failed to get Facebook profile', error);
      throw error;
    }
  }

  async validateWebhook(payload, signature) {
    // Facebook webhook validation
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
              platform: 'facebook',
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
              platform: 'facebook',
              conversationId: event.sender.id
            };

            messages.push(processedMessage);
          }

          if (event.delivery) {
            const delivery = event.delivery;
            const statusMessage = {
              id: `delivery_${event.timestamp}`,
              from: event.sender.id,
              timestamp: event.timestamp,
              type: 'delivery',
              status: 'delivered',
              platform: 'facebook',
              conversationId: event.sender.id
            };

            messages.push(statusMessage);
          }
        }
      }

      logger.info('Facebook webhook processed', {
        messageCount: messages.length
      });

      return messages;
    } catch (error) {
      logger.error('Failed to process Facebook webhook', error);
      throw error;
    }
  }

  // Facebook specific methods
  async sendQuickReplies(conversationId, text, quickReplies) {
    try {
      const payload = {
        recipient: {
          id: conversationId
        },
        message: {
          text: text,
          quick_replies: quickReplies.map(reply => ({
            content_type: 'text',
            title: reply.title,
            payload: reply.payload
          }))
        }
      };

      const response = await this.makeRequest('POST', `/me/messages`, payload);
      
      logger.info('Facebook quick replies sent', {
        conversationId,
        messageId: response.message_id
      });

      return {
        success: true,
        messageId: response.message_id,
        platform: 'facebook'
      };
    } catch (error) {
      logger.error('Failed to send Facebook quick replies', error);
      throw error;
    }
  }

  async sendGenericTemplate(conversationId, elements) {
    try {
      const payload = {
        recipient: {
          id: conversationId
        },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: elements
            }
          }
        }
      };

      const response = await this.makeRequest('POST', `/me/messages`, payload);
      
      logger.info('Facebook generic template sent', {
        conversationId,
        messageId: response.message_id
      });

      return {
        success: true,
        messageId: response.message_id,
        platform: 'facebook'
      };
    } catch (error) {
      logger.error('Failed to send Facebook generic template', error);
      throw error;
    }
  }
}

module.exports = FacebookAdapter;







