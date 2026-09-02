// src/core/DatabaseManager.js
const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000;
  }

  // Initialize database connection
  async initialize() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      await this.testConnection();
      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info('✅ Database connected successfully');
      return true;

    } catch (error) {
      logger.error('❌ Database connection failed:', error.message);
      return await this.handleConnectionError(error);
    }
  }

  // Test database connection
  async testConnection() {
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();
  }

  // Handle connection errors with retry logic
  async handleConnectionError(error) {
    this.connectionRetries++;
    
    if (this.connectionRetries < this.maxRetries) {
      logger.warn(`🔄 Retrying database connection (${this.connectionRetries}/${this.maxRetries})`);
      await this.sleep(this.retryDelay * this.connectionRetries);
      return await this.initialize();
    } else {
      logger.error('❌ Max database connection retries exceeded');
      this.isConnected = false;
      return false;
    }
  }

  // Execute query with error handling
  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      logger.error('Database query error:', {
        query: text,
        params,
        error: error.message
      });
      
      // If connection lost, try to reconnect
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
        this.isConnected = false;
        await this.initialize();
        throw new Error('Database connection lost, please retry');
      }
      
      throw error;
    }
  }

  // Store message with proper error handling
  async storeMessage(messageData) {
    try {
      const { id, conversationId, content, type, sender_type, platform, timestamp, created_at } = messageData;
      
      const result = await this.query(`
        INSERT INTO messages (
          id, conversation_id, content, message_type, sender_type, 
          platform, created_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        id,
        conversationId,
        content,
        type,
        sender_type,
        platform,
        created_at || new Date().toISOString(),
        'received'
      ]);

      logger.info('✅ Message stored successfully', {
        messageId: id,
        conversationId,
        platform
      });

      return result.rows[0];

    } catch (error) {
      logger.error('❌ Failed to store message:', {
        messageId: messageData.id,
        error: error.message
      });
      throw error;
    }
  }

  // Store user with proper error handling
  async storeUser(userData) {
    try {
      const { platform_id, platform, name, metadata } = userData;
      
      // Check if user exists
      const existing = await this.query(
        'SELECT * FROM users WHERE platform_id = $1 AND platform = $2',
        [platform_id, platform]
      );

      if (existing.rows.length > 0) {
        return existing.rows[0];
      }

      // Create new user
      const result = await this.query(`
        INSERT INTO users (
          platform_id, platform, name, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `, [
        platform_id,
        platform,
        name || platform_id,
        JSON.stringify(metadata || {})
      ]);

      logger.info('✅ User stored successfully', {
        userId: result.rows[0].id,
        platform,
        platform_id
      });

      return result.rows[0];

    } catch (error) {
      logger.error('❌ Failed to store user:', {
        platform_id: userData.platform_id,
        platform: userData.platform,
        error: error.message
      });
      throw error;
    }
  }

  // Store conversation with proper error handling
  async storeConversation(conversationData) {
    try {
      const { user_id, platform, status = 'active' } = conversationData;
      
      // Check if conversation exists
      const existing = await this.query(
        'SELECT * FROM conversations WHERE user_id = $1 AND platform = $2',
        [user_id, platform]
      );

      if (existing.rows.length > 0) {
        return existing.rows[0];
      }

      // Create new conversation
      const result = await this.query(`
        INSERT INTO conversations (
          user_id, platform, status, created_at, updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING *
      `, [user_id, platform, status]);

      logger.info('✅ Conversation stored successfully', {
        conversationId: result.rows[0].id,
        userId: user_id,
        platform
      });

      return result.rows[0];

    } catch (error) {
      logger.error('❌ Failed to store conversation:', {
        user_id: conversationData.user_id,
        platform: conversationData.platform,
        error: error.message
      });
      throw error;
    }
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      retries: this.connectionRetries,
      maxRetries: this.maxRetries
    };
  }

  // Close connection
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('🔌 Database connection closed');
    }
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DatabaseManager;
















