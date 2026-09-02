/**
 * Redis Cache Service
 * Provides caching layer for improved performance
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisCacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        // Retry with exponential backoff
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis retry attempt ${times} in ${delay}ms`, { 
          type: 'cache', 
          component: 'redis', 
          retryAttempt: times 
        });
        return delay;
      }
    };
    
    // Cache TTL (Time To Live) settings
    this.ttl = {
      profile: 3600,      // 1 hour
      conversation: 1800, // 30 minutes
      message: 600,       // 10 minutes
      user: 3600          // 1 hour
    };
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      // Check if Redis is configured
      if (!this.config.host || this.config.host === 'localhost') {
        logger.warn('Redis not configured, using in-memory cache', { 
          type: 'cache', 
          component: 'redis' 
        });
        return false;
      }

      this.client = new Redis(this.config);

      // Connection event handlers
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected successfully', { 
          type: 'cache', 
          component: 'redis', 
          host: this.config.host,
          port: this.config.port
        });
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error', err, { 
          type: 'cache', 
          component: 'redis' 
        });
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed', { 
          type: 'cache', 
          component: 'redis' 
        });
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting...', { 
          type: 'cache', 
          component: 'redis' 
        });
      });

      // Test connection
      await this.client.ping();
      this.isConnected = true;
      
      logger.info('Redis initialized successfully', { 
        type: 'cache', 
        component: 'redis' 
      });
      
      return true;
    } catch (error) {
      logger.error('Redis initialization failed', error, { 
        type: 'cache', 
        component: 'redis' 
      });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.isConnected) return null;
    
    try {
      const value = await this.client.get(key);
      if (value) {
        logger.debug('Cache hit', { type: 'cache', key });
        return JSON.parse(value);
      }
      logger.debug('Cache miss', { type: 'cache', key });
      return null;
    } catch (error) {
      logger.error('Cache get error', error, { type: 'cache', key });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = null) {
    if (!this.isConnected) return false;
    
    try {
      const serialized = JSON.stringify(value);
      const seconds = ttl || this.ttl.profile;
      
      await this.client.setex(key, seconds, serialized);
      logger.debug('Cache set', { type: 'cache', key, ttl: seconds });
      return true;
    } catch (error) {
      logger.error('Cache set error', error, { type: 'cache', key });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.del(key);
      logger.debug('Cache deleted', { type: 'cache', key });
      return true;
    } catch (error) {
      logger.error('Cache delete error', error, { type: 'cache', key });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key) {
    if (!this.isConnected) return false;
    
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', error, { type: 'cache', key });
      return false;
    }
  }

  /**
   * Cache user profile
   */
  async cacheUserProfile(platform, userId, profile) {
    const key = `user:${platform}:${userId}`;
    return await this.set(key, profile, this.ttl.user);
  }

  /**
   * Get user profile from cache
   */
  async getUserProfile(platform, userId) {
    const key = `user:${platform}:${userId}`;
    return await this.get(key);
  }

  /**
   * Cache conversation
   */
  async cacheConversation(conversationId, conversation) {
    const key = `conversation:${conversationId}`;
    return await this.set(key, conversation, this.ttl.conversation);
  }

  /**
   * Get conversation from cache
   */
  async getConversation(conversationId) {
    const key = `conversation:${conversationId}`;
    return await this.get(key);
  }

  /**
   * Cache message list
   */
  async cacheMessages(conversationId, messages) {
    const key = `messages:${conversationId}`;
    return await this.set(key, messages, this.ttl.message);
  }

  /**
   * Get messages from cache
   */
  async getMessages(conversationId) {
    const key = `messages:${conversationId}`;
    return await this.get(key);
  }

  /**
   * Clear cache for conversation
   */
  async clearConversationCache(conversationId) {
    const keys = [
      `conversation:${conversationId}`,
      `messages:${conversationId}`
    ];
    
    for (const key of keys) {
      await this.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return { connected: false, error: 'Redis not connected' };
    }

    try {
      const info = await this.client.info('stats');
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: true,
        info: this.parseInfo(info),
        keyspace: this.parseInfo(keyspace)
      };
    } catch (error) {
      logger.error('Failed to get Redis stats', error, { type: 'cache', component: 'redis' });
      return { connected: false, error: error.message };
    }
  }

  /**
   * Parse Redis INFO output
   */
  parseInfo(info) {
    const lines = info.split('\n');
    const result = {};
    
    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }
    
    return result;
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed', { type: 'cache', component: 'redis' });
    }
  }
}

// Export singleton instance
const redisCache = new RedisCacheService();
module.exports = redisCache;


