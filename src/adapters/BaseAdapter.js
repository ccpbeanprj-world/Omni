const axios = require('axios');
const logger = require('../utils/logger');

class BaseAdapter {
  constructor(platform, config) {
    this.platform = platform;
    this.config = config;
    this.baseURL = config.baseURL;
    this.accessToken = config.accessToken;
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    // Add request/response interceptors
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`[${this.platform}] API Request`, {
          method: config.method,
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error(`[${this.platform}] Request Error`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`[${this.platform}] API Response`, {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error(`[${this.platform}] Response Error`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  // Abstract methods to be implemented by subclasses
  async sendMessage(conversationId, message) {
    throw new Error('sendMessage method must be implemented by subclass');
  }

  async sendMedia(conversationId, mediaUrl, mediaType, caption = '') {
    throw new Error('sendMedia method must be implemented by subclass');
  }

  async markAsRead(conversationId, messageId) {
    throw new Error('markAsRead method must be implemented by subclass');
  }

  async getProfile(userId) {
    throw new Error('getProfile method must be implemented by subclass');
  }

  async validateWebhook(payload, signature) {
    throw new Error('validateWebhook method must be implemented by subclass');
  }

  async processWebhook(payload) {
    throw new Error('processWebhook method must be implemented by subclass');
  }

  // Common utility methods
  async makeRequest(method, url, data = null, headers = {}) {
    try {
      const response = await this.client({
        method,
        url,
        data,
        headers
      });
      return response.data;
    } catch (error) {
      logger.error(`[${this.platform}] API Request Failed`, {
        method,
        url,
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }

  // Rate limiting helper
  async checkRateLimit() {
    // Implement platform-specific rate limiting logic
    return true;
  }

  // Error handling
  handleError(error, context = {}) {
    const errorInfo = {
      platform: this.platform,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      ...context
    };

    logger.error(`[${this.platform}] Error`, errorInfo);
    return errorInfo;
  }

  // Message formatting helpers
  formatMessage(message) {
    return {
      id: message.id || this.generateId(),
      text: message.text || '',
      type: message.type || 'text',
      timestamp: message.timestamp || new Date().toISOString(),
      sender: message.sender || {},
      metadata: message.metadata || {}
    };
  }

  generateId() {
    return `${this.platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = BaseAdapter;







