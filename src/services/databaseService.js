const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'omni_platform',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.testConnection();
  }

  async testConnection() {
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connection established');
      client.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  // User operations
  async createUser(userData) {
    const query = `
      INSERT INTO users (
        platform_id, platform, name, display_name, profile_picture_url,
        status, status_message, language, last_seen, additional_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      userData.platform_id,
      userData.platform,
      userData.name,
      userData.display_name,
      userData.profile_picture_url,
      userData.status || 'active',
      userData.status_message || '',
      userData.language || 'en',
      userData.last_seen ? new Date(userData.last_seen) : null,
      userData.additional_data ? JSON.stringify(userData.additional_data) : null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getUserByPlatformId(platformId, platform) {
    const query = `
      SELECT * FROM users 
      WHERE platform_id = $1 AND platform = $2
    `;
    const result = await this.pool.query(query, [platformId, platform]);
    return result.rows[0];
  }

  async updateUser(userId, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [userId, ...values]);
    return result.rows[0];
  }

  async getAllUsers() {
    const query = 'SELECT * FROM users ORDER BY created_at DESC';
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Conversation operations
  async createConversation(conversationData) {
    const query = `
      INSERT INTO conversations (
        user_id, platform, platform_conversation_id, status,
        user_name, profile_picture_url, business_account_name,
        last_message, last_message_at, message_count,
        real_data_synced, real_sync_date, is_real_user, additional_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      conversationData.user_id,
      conversationData.platform,
      conversationData.platform_conversation_id,
      conversationData.status || 'pending',
      conversationData.user_name,
      conversationData.profile_picture_url,
      conversationData.business_account_name,
      conversationData.last_message,
      conversationData.last_message_at ? new Date(conversationData.last_message_at) : null,
      conversationData.message_count || 0,
      conversationData.real_data_synced || false,
      conversationData.real_sync_date ? new Date(conversationData.real_sync_date) : null,
      conversationData.is_real_user || false,
      conversationData.additional_data ? JSON.stringify(conversationData.additional_data) : null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getConversationById(conversationId) {
    const query = `
      SELECT c.*, u.display_name, u.profile_picture_url
      FROM conversations c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `;
    const result = await this.pool.query(query, [conversationId]);
    return result.rows[0];
  }

  async getConversationByPlatformId(platformId, platform) {
    const query = `
      SELECT c.*, u.display_name, u.profile_picture_url
      FROM conversations c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.platform_conversation_id = $1 AND c.platform = $2
    `;
    const result = await this.pool.query(query, [platformId, platform]);
    return result.rows[0];
  }

  async updateConversation(conversationId, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE conversations 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [conversationId, ...values]);
    return result.rows[0];
  }

  async getAllConversations() {
    const query = `
      SELECT c.*, u.display_name, u.profile_picture_url
      FROM conversations c
      LEFT JOIN users u ON c.user_id = u.id
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Message operations
  async createMessage(messageData) {
    const query = `
      INSERT INTO messages (
        conversation_id, sender_id, sender_name, sender_type,
        message_type, content, platform, platform_message_id,
        status, read_at, read_by, line_read_receipt_id,
        line_read_receipt_sent_at, additional_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      messageData.conversation_id,
      messageData.sender_id,
      messageData.sender_name,
      messageData.sender_type,
      messageData.message_type || 'text',
      messageData.content,
      messageData.platform,
      messageData.platform_message_id,
      messageData.status || 'sent',
      messageData.read_at ? new Date(messageData.read_at) : null,
      messageData.read_by,
      messageData.line_read_receipt_id,
      messageData.line_read_receipt_sent_at ? new Date(messageData.line_read_receipt_sent_at) : null,
      messageData.additional_data ? JSON.stringify(messageData.additional_data) : null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getMessagesByConversation(conversationId, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM messages 
      WHERE conversation_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [conversationId, limit, offset]);
    return result.rows;
  }

  async updateMessage(messageId, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE messages 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [messageId, ...values]);
    return result.rows[0];
  }

  async getAllMessages() {
    const query = 'SELECT * FROM messages ORDER BY created_at DESC';
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Message queue operations
  async addToQueue(queueData) {
    const query = `
      INSERT INTO message_queue (
        platform, message_type, payload, status, retry_count, max_retries
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      queueData.platform,
      queueData.message_type,
      JSON.stringify(queueData.payload),
      queueData.status || 'pending',
      queueData.retry_count || 0,
      queueData.max_retries || 3
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getQueueItems(status = 'pending', limit = 10) {
    const query = `
      SELECT * FROM message_queue 
      WHERE status = $1 
      ORDER BY created_at ASC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [status, limit]);
    return result.rows;
  }

  async updateQueueItem(queueId, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE message_queue 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [queueId, ...values]);
    return result.rows[0];
  }

  // Platform configuration operations
  async getPlatformConfig(platform) {
    const query = 'SELECT * FROM platform_configs WHERE platform = $1';
    const result = await this.pool.query(query, [platform]);
    return result.rows[0];
  }

  async updatePlatformConfig(platform, configData) {
    const query = `
      UPDATE platform_configs 
      SET config_data = $2, updated_at = CURRENT_TIMESTAMP
      WHERE platform = $1
      RETURNING *
    `;
    const result = await this.pool.query(query, [platform, JSON.stringify(configData)]);
    return result.rows[0];
  }

  // Statistics
  async getStats() {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM conversations) as conversation_count,
        (SELECT COUNT(*) FROM messages) as message_count,
        (SELECT COUNT(*) FROM message_queue WHERE status = 'pending') as pending_queue_count
    `;
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  // Close connection pool
  async close() {
    await this.pool.end();
  }
}

module.exports = DatabaseService;






