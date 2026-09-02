const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class LineAdapter extends BaseAdapter {
  constructor(config) {
    super('line', {
      ...config,
      baseURL: 'https://api.line.me/v2'
    });
    
    this.channelAccessToken = config.channelAccessToken;
    this.channelSecret = config.channelSecret;
  }

  async sendMessage(conversationId, message) {
    try {
      const payload = {
        to: conversationId,
        messages: [
          {
            type: 'text',
            text: message.text
          }
        ]
      };

      const response = await this.makeRequest('POST', '/bot/message/push', payload, {
        'Authorization': `Bearer ${this.channelAccessToken}`,
        'Content-Type': 'application/json'
      });
      
      logger.info('LINE message sent', {
        conversationId,
        messageId: response.messageId
      });

      return {
        success: true,
        messageId: response.messageId,
        platform: 'line'
      };
    } catch (error) {
      logger.error('Failed to send LINE message', error);
      throw error;
    }
  }

  async sendMedia(conversationId, mediaUrl, mediaType, caption = '') {
    try {
      let messageType;
      let messageContent;

      switch (mediaType) {
        case 'image':
          messageType = 'image';
          messageContent = {
            type: 'image',
            originalContentUrl: mediaUrl,
            previewImageUrl: mediaUrl
          };
          break;
        case 'video':
          messageType = 'video';
          messageContent = {
            type: 'video',
            originalContentUrl: mediaUrl,
            previewImageUrl: mediaUrl
          };
          break;
        case 'audio':
          messageType = 'audio';
          messageContent = {
            type: 'audio',
            originalContentUrl: mediaUrl,
            duration: 60000
          };
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      const payload = {
        to: conversationId,
        messages: [messageContent]
      };

      const response = await this.makeRequest('POST', '/bot/message/push', payload, {
        'Authorization': `Bearer ${this.channelAccessToken}`,
        'Content-Type': 'application/json'
      });
      
      logger.info('LINE media sent', {
        conversationId,
        mediaType,
        messageId: response.messageId
      });

      return {
        success: true,
        messageId: response.messageId,
        platform: 'line'
      };
    } catch (error) {
      logger.error('Failed to send LINE media', error);
      throw error;
    }
  }

  async markAsRead(conversationId, messageId) {
    // LINE doesn't have a direct read receipt API
    logger.info('LINE read receipt not supported', {
      conversationId,
      messageId
    });

    return { success: true };
  }

  async getProfile(userId) {
    try {
      const response = await this.makeRequest('GET', `/bot/profile/${userId}`, null, {
        'Authorization': `Bearer ${this.channelAccessToken}`
      });
      
      return {
        id: userId,
        name: response.displayName,
        profile_picture_url: response.pictureUrl,
        platform: 'line'
      };
    } catch (error) {
      logger.error('Failed to get LINE profile', error);
      throw error;
    }
  }

  async validateWebhook(payload, signature) {
    // LINE webhook validation
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.channelSecret)
      .update(JSON.stringify(payload))
      .digest('base64');

    return signature === expectedSignature;
  }

  async processWebhook(payload) {
    try {
      const events = payload.events || [];
      const messages = [];

      for (const event of events) {
        if (event.type === 'message') {
          const message = event.message;
          const processedMessage = {
            id: message.id,
            from: event.source.userId,
            timestamp: event.timestamp,
            type: message.type,
            text: message.text || '',
            media: this.extractMedia(message),
            platform: 'line',
            conversationId: event.source.userId,
            sender_type: 'user',
            sender: {
              id: event.source.userId,
              name: 'LINE User',
              platform: 'line'
            },
            status: 'received',
            created_at: new Date(event.timestamp).toISOString()
          };

          messages.push(processedMessage);
        }

        if (event.type === 'postback') {
          const processedMessage = {
            id: `postback_${event.timestamp}`,
            from: event.source.userId,
            timestamp: event.timestamp,
            type: 'postback',
            text: event.postback.data,
            payload: event.postback.data,
            platform: 'line',
            conversationId: event.source.userId,
            sender_type: 'user',
            sender: {
              id: event.source.userId,
              name: 'LINE User',
              platform: 'line'
            },
            status: 'received',
            created_at: new Date(event.timestamp).toISOString()
          };

          messages.push(processedMessage);
        }

        // Handle follow events (user follows/unfollows)
        if (event.type === 'follow') {
          const processedMessage = {
            id: `follow_${event.timestamp}`,
            from: event.source.userId,
            timestamp: event.timestamp,
            type: 'system',
            text: 'User started following',
            platform: 'line',
            conversationId: event.source.userId,
            sender_type: 'system',
            sender: {
              id: 'system',
              name: 'System',
              platform: 'line'
            },
            status: 'received',
            created_at: new Date(event.timestamp).toISOString()
          };

          messages.push(processedMessage);
        }

        // Handle unfollow events
        if (event.type === 'unfollow') {
          const processedMessage = {
            id: `unfollow_${event.timestamp}`,
            from: event.source.userId,
            timestamp: event.timestamp,
            type: 'system',
            text: 'User unfollowed',
            platform: 'line',
            conversationId: event.source.userId,
            sender_type: 'system',
            sender: {
              id: 'system',
              name: 'System',
              platform: 'line'
            },
            status: 'received',
            created_at: new Date(event.timestamp).toISOString()
          };

          messages.push(processedMessage);
        }
      }

      logger.info('LINE webhook processed', {
        messageCount: messages.length,
        eventTypes: events.map(e => e.type)
      });

      return messages;
    } catch (error) {
      logger.error('Failed to process LINE webhook', error);
      throw error;
    }
  }

  extractMedia(message) {
    const media = {};
    
    switch (message.type) {
      case 'image':
        media.image = {
          id: message.id,
          contentProvider: message.contentProvider
        };
        break;
      case 'video':
        media.video = {
          id: message.id,
          duration: message.duration,
          contentProvider: message.contentProvider
        };
        break;
      case 'audio':
        media.audio = {
          id: message.id,
          duration: message.duration,
          contentProvider: message.contentProvider
        };
        break;
      case 'file':
        media.file = {
          id: message.id,
          fileName: message.fileName,
          fileSize: message.fileSize
        };
        break;
      case 'location':
        media.location = {
          title: message.title,
          address: message.address,
          latitude: message.latitude,
          longitude: message.longitude
        };
        break;
    }

    return media;
  }

  // LINE specific methods
  async sendFlexMessage(conversationId, flexMessage) {
    try {
      const payload = {
        to: conversationId,
        messages: [
          {
            type: 'flex',
            altText: flexMessage.altText,
            contents: flexMessage.contents
          }
        ]
      };

      const response = await this.makeRequest('POST', '/bot/message/push', payload, {
        'Authorization': `Bearer ${this.channelAccessToken}`,
        'Content-Type': 'application/json'
      });
      
      logger.info('LINE flex message sent', {
        conversationId,
        messageId: response.messageId
      });

      return {
        success: true,
        messageId: response.messageId,
        platform: 'line'
      };
    } catch (error) {
      logger.error('Failed to send LINE flex message', error);
      throw error;
    }
  }

  async sendQuickReply(conversationId, text, quickReply) {
    try {
      const payload = {
        to: conversationId,
        messages: [
          {
            type: 'text',
            text: text,
            quickReply: quickReply
          }
        ]
      };

      const response = await this.makeRequest('POST', '/bot/message/push', payload, {
        'Authorization': `Bearer ${this.channelAccessToken}`,
        'Content-Type': 'application/json'
      });
      
      logger.info('LINE quick reply sent', {
        conversationId,
        messageId: response.messageId
      });

      return {
        success: true,
        messageId: response.messageId,
        platform: 'line'
      };
    } catch (error) {
      logger.error('Failed to send LINE quick reply', error);
      throw error;
    }
  }
}

module.exports = LineAdapter;


