const crypto = require('crypto');
const logger = require('../utils/logger');

class WhatsAppWebhookHandler {
  constructor(config) {
    this.verifyToken = config.verifyToken;
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
  }

  /**
   * Verify WhatsApp webhook signature
   */
  verifyWebhookSignature(body, signature) {
    try {
      if (!this.verifyToken) {
        logger.error('❌ WHATSAPP: Verify token not configured');
        return false;
      }
      
      if (!signature) {
        logger.error('❌ WHATSAPP: No signature provided');
        return false;
      }
      
      // WhatsApp uses HMAC-SHA256 for webhook verification
      const hash = crypto
        .createHmac('sha256', this.verifyToken)
        .update(body)
        .digest('hex');
      
      const isValid = hash === signature;
      
      if (!isValid) {
        logger.error('❌ WHATSAPP: Signature verification failed');
        logger.error(`   Expected: ${hash}`);
        logger.error(`   Received: ${signature}`);
        logger.error(`   Body length: ${body.length}`);
      } else {
        logger.info('✅ WHATSAPP: Signature verification successful');
      }
      
      return isValid;
    } catch (error) {
      logger.error('❌ WHATSAPP: Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Process WhatsApp webhook events
   */
  async processWebhookEvents(events, io = null) {
    try {
      logger.info('📱 WHATSAPP: Processing webhook events', {
        eventCount: events.length,
        phoneNumberId: this.phoneNumberId
      });

      const processedMessages = [];

      for (const entry of events) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Process incoming messages
            if (value.messages) {
              for (const message of value.messages) {
                const processedMessage = await this.processIncomingMessage(message, value);
                if (processedMessage) {
                  processedMessages.push(processedMessage);
                }
              }
            }

            // Process status updates (delivered, read, etc.)
            if (value.statuses) {
              for (const status of value.statuses) {
                const statusMessage = await this.processStatusUpdate(status, value);
                if (statusMessage) {
                  processedMessages.push(statusMessage);
                }
              }
            }
          }
        }
      }

      logger.info('📱 WHATSAPP: Webhook processing completed', {
        processedCount: processedMessages.length,
        phoneNumberId: this.phoneNumberId
      });

      return processedMessages;
    } catch (error) {
      logger.error('❌ WHATSAPP: Failed to process webhook events:', error);
      throw error;
    }
  }

  /**
   * Process incoming WhatsApp message
   */
  async processIncomingMessage(message, webhookValue) {
    try {
      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        platform_message_id: message.id,
        sender_id: message.from,
        sender_name: message.from, // Will be updated with profile info
        sender_type: 'user',
        message_type: message.type,
        content: this.extractMessageContent(message),
        platform: 'whatsapp',
        conversation_id: `conv_whatsapp_${message.from}`,
        timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        created_at: new Date().toISOString(),
        additional_data: {
          whatsapp_message_id: message.id,
          phone_number_id: this.phoneNumberId,
          business_account_id: this.businessAccountId,
          original_message: message,
          webhook_context: webhookValue
        }
      };

      // Extract media information if present
      if (message.image || message.video || message.audio || message.document) {
        const media = message.image || message.video || message.audio || message.document;
        messageData.media_url = media.link || media.id;
        messageData.media_type = message.type;
        messageData.caption = media.caption || '';
      }

      logger.info('📱 WHATSAPP: Processed incoming message', {
        messageId: messageData.id,
        platformMessageId: message.id,
        senderId: message.from,
        messageType: message.type,
        contentLength: messageData.content.length
      });

      return messageData;
    } catch (error) {
      logger.error('❌ WHATSAPP: Failed to process incoming message:', error);
      return null;
    }
  }

  /**
   * Process WhatsApp status updates (delivered, read, etc.)
   */
  async processStatusUpdate(status, webhookValue) {
    try {
      const statusMessage = {
        id: `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        platform_message_id: status.id,
        sender_id: status.recipient_id,
        sender_name: status.recipient_id,
        sender_type: 'system',
        message_type: 'status',
        content: `Message ${status.status}`,
        platform: 'whatsapp',
        conversation_id: `conv_whatsapp_${status.recipient_id}`,
        timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
        created_at: new Date().toISOString(),
        additional_data: {
          whatsapp_message_id: status.id,
          status: status.status,
          phone_number_id: this.phoneNumberId,
          business_account_id: this.businessAccountId,
          original_status: status,
          webhook_context: webhookValue
        }
      };

      logger.info('📱 WHATSAPP: Processed status update', {
        messageId: statusMessage.id,
        platformMessageId: status.id,
        recipientId: status.recipient_id,
        status: status.status
      });

      return statusMessage;
    } catch (error) {
      logger.error('❌ WHATSAPP: Failed to process status update:', error);
      return null;
    }
  }

  /**
   * Extract message content based on type
   */
  extractMessageContent(message) {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';
      
      case 'image':
        return message.image?.caption || '[Image]';
      
      case 'video':
        return message.video?.caption || '[Video]';
      
      case 'audio':
        return '[Audio Message]';
      
      case 'document':
        return message.document?.caption || `[Document: ${message.document?.filename || 'Unknown'}]`;
      
      case 'location':
        return `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
      
      case 'contacts':
        return '[Contact Card]';
      
      case 'interactive':
        return message.interactive?.button_reply?.title || 
               message.interactive?.list_reply?.title || 
               '[Interactive Message]';
      
      case 'sticker':
        return '[Sticker]';
      
      case 'system':
        return message.system?.body || '[System Message]';
      
      default:
        return `[${message.type} Message]`;
    }
  }

  /**
   * Get WhatsApp user profile
   */
  async getUserProfile(phoneNumber) {
    try {
      const axios = require('axios');
      const response = await axios.get(
        `https://graph.facebook.com/${this.apiVersion || 'v18.0'}/${phoneNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          params: {
            fields: 'name,profile_picture'
          }
        }
      );

      return {
        id: phoneNumber,
        name: response.data.name || phoneNumber,
        profile_picture_url: response.data.profile_picture?.data?.url,
        platform: 'whatsapp',
        phone_number: phoneNumber
      };
    } catch (error) {
      logger.warn('⚠️ WHATSAPP: Failed to get user profile', {
        phoneNumber,
        error: error.message
      });
      
      // Return basic profile info if API call fails
      return {
        id: phoneNumber,
        name: phoneNumber,
        profile_picture_url: null,
        platform: 'whatsapp',
        phone_number: phoneNumber
      };
    }
  }

  /**
   * Validate webhook configuration
   */
  validateConfiguration() {
    const requiredFields = [
      'verifyToken',
      'accessToken', 
      'phoneNumberId',
      'businessAccountId'
    ];

    const missingFields = requiredFields.filter(field => !this[field]);
    
    if (missingFields.length > 0) {
      logger.error('❌ WHATSAPP: Missing required configuration', {
        missingFields,
        phoneNumberId: this.phoneNumberId
      });
      return false;
    }

    logger.info('✅ WHATSAPP: Configuration validated', {
      phoneNumberId: this.phoneNumberId,
      businessAccountId: this.businessAccountId,
      apiVersion: this.apiVersion || 'v18.0'
    });

    return true;
  }
}

module.exports = WhatsAppWebhookHandler;


