const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Twilio WhatsApp Business Platform Adapter
 * Implements WhatsApp messaging via Twilio's API
 */
class TwilioWhatsAppAdapter extends BaseAdapter {
  constructor(config) {
    super('whatsapp', {
      ...config,
      baseURL: 'https://api.twilio.com/2010-04-01'
    });
    
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.phoneNumber = config.phoneNumber; // WhatsApp phone number from Twilio
    
    // Set up axios instance with Twilio authentication
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.accountSid,
        password: this.authToken
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });
  }

  /**
   * Send WhatsApp message via Twilio
   */
  async sendMessage(toNumber, message) {
    try {
      // Clean phone number (remove whatsapp: prefix if present)
      const cleanToNumber = toNumber.replace(/^whatsapp:/, '');
      
      const payload = {
        From: `whatsapp:${this.phoneNumber}`,
        To: `whatsapp:${cleanToNumber}`,
        Body: typeof message === 'string' ? message : (message.text || message.content || '')
      };

      logger.info('Sending WhatsApp message via Twilio', {
        from: payload.From,
        to: payload.To,
        body: payload.Body.substring(0, 50) + '...'
      });

      const response = await this.httpClient.post(`/Accounts/${this.accountSid}/Messages.json`, 
        new URLSearchParams(payload).toString()
      );
      
      logger.info('WhatsApp message sent successfully via Twilio', {
        messageSid: response.data.sid,
        status: response.data.status,
        to: cleanToNumber
      });

      return {
        success: true,
        messageId: response.data.sid,
        platform: 'whatsapp',
        conversationId: cleanToNumber,
        timestamp: new Date().toISOString(),
        status: response.data.status
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp message via Twilio', {
        error: error.message,
        toNumber,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Enhanced error handling for Twilio API errors
      if (error.response?.status === 400) {
        const twilioError = error.response.data;
        logger.error('Twilio 400 Error Details:', {
          code: twilioError.code,
          message: twilioError.message,
          more_info: twilioError.more_info,
          status: twilioError.status
        });
        
        // Throw a more descriptive error
        throw new Error(`Twilio API Error ${twilioError.code}: ${twilioError.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Send media message via Twilio
   */
  async sendMedia(conversationId, mediaUrl, caption = '') {
    try {
      const toNumber = conversationId.replace('whatsapp:', '');
      
      const payload = {
        From: `whatsapp:${this.phoneNumber}`,
        To: `whatsapp:${toNumber}`,
        MediaUrl: mediaUrl,
        Body: caption
      };

      const response = await this.httpClient.post(`/Accounts/${this.accountSid}/Messages.json`, 
        new URLSearchParams(payload).toString()
      );
      
      logger.info('WhatsApp media message sent successfully via Twilio', {
        messageSid: response.data.sid,
        mediaUrl: mediaUrl
      });

      return {
        success: true,
        messageId: response.data.sid,
        platform: 'whatsapp',
        conversationId: conversationId,
        timestamp: new Date().toISOString(),
        mediaUrl: mediaUrl
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp media via Twilio', {
        error: error.message,
        conversationId,
        mediaUrl
      });
      throw error;
    }
  }

  /**
   * Get message status from Twilio
   */
  async getMessageStatus(messageId) {
    try {
      const response = await this.httpClient.get(`/Accounts/${this.accountSid}/Messages/${messageId}.json`);
      
      return {
        messageId: messageId,
        status: response.data.status,
        errorCode: response.data.error_code,
        errorMessage: response.data.error_message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get message status from Twilio', {
        error: error.message,
        messageId
      });
      throw error;
    }
  }

  /**
   * Validate webhook signature (Twilio uses different method)
   */
  validateWebhookSignature(body, signature, url) {
    // Twilio uses HMAC-SHA1 with auth token
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha1', this.authToken)
      .update(url + body)
      .digest('base64');
    
    return signature === expectedSignature;
  }

  /**
   * Process incoming webhook from Twilio
   */
  async processWebhook(webhookData) {
    try {
      const messages = [];
      
      // Twilio sends webhook data differently than Facebook
      if (webhookData.MessageSid) {
        const message = {
          platform: 'whatsapp',
          messageId: webhookData.MessageSid,
          from: webhookData.From?.replace('whatsapp:', ''),
          to: webhookData.To?.replace('whatsapp:', ''),
          body: webhookData.Body,
          messageStatus: webhookData.MessageStatus,
          timestamp: new Date().toISOString(),
          direction: webhookData.Direction
        };
        
        messages.push(message);
      }
      
      return messages;
    } catch (error) {
      logger.error('Failed to process Twilio webhook', {
        error: error.message,
        webhookData
      });
      throw error;
    }
  }

  /**
   * Get user profile (Enhanced for better user info)
   */
  async getUserProfile(phoneNumber) {
    try {
      // Clean phone number
      const cleanPhoneNumber = phoneNumber.replace(/^whatsapp:/, '').replace(/^\+/, '');
      
      // Twilio doesn't provide direct profile API, but we can try to get basic info
      // For now, return formatted profile with phone number
      const profile = {
        name: `+${cleanPhoneNumber}`,
        phone_number: `+${cleanPhoneNumber}`,
        profile_picture_url: null,
        platform: 'whatsapp',
        verified: false
      };

      logger.info('WhatsApp user profile retrieved', {
        phoneNumber: cleanPhoneNumber,
        profile: profile
      });

      return profile;
    } catch (error) {
      logger.error('Failed to get WhatsApp user profile', {
        error: error.message,
        phoneNumber
      });
      
      // Return fallback profile
      return {
        name: `WhatsApp User ${phoneNumber}`,
        phone_number: phoneNumber,
        profile_picture_url: null,
        platform: 'whatsapp',
        verified: false
      };
    }
  }
}

module.exports = TwilioWhatsAppAdapter;
