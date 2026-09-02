/**
 * Standardized Data Storage Service
 * Handles SQLite primary with JSON fallback strategy
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class DataStorageService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.storageStrategy = 'sqlite'; // 'sqlite' or 'json'
    this.jsonFiles = {
      users: path.join(__dirname, '../../users.json'),
      conversations: path.join(__dirname, '../../conversations.json'),
      messages: path.join(__dirname, '../../messages.json')
    };
  }

  /**
   * Initialize the data storage service
   */
  async initialize(dbPath = './omni.db') {
    try {
      // Try to initialize SQLite
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ SQLite initialization failed:', err.message);
          this.storageStrategy = 'json';
        } else {
          console.log('✅ SQLite database initialized');
          this.storageStrategy = 'sqlite';
          this.createTables();
        }
      });

      this.isInitialized = true;
      console.log(`📊 Data Storage Strategy: ${this.storageStrategy.toUpperCase()}`);
      
    } catch (error) {
      console.error('❌ Data storage initialization failed:', error.message);
      this.storageStrategy = 'json';
      this.isInitialized = true;
    }
  }

  /**
   * Create SQLite tables
   */
  createTables() {
    if (!this.db || this.storageStrategy !== 'sqlite') return;

    this.db.serialize(() => {
      // Users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          platform_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          name TEXT,
          display_name TEXT,
          profile_picture_url TEXT,
          status TEXT DEFAULT 'active',
          status_message TEXT,
          language TEXT DEFAULT 'en',
          last_seen TEXT,
          additional_data TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Conversations table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          platform_conversation_id TEXT,
          platform_user_id TEXT,
          status TEXT DEFAULT 'active',
          user_name TEXT,
          profile_picture_url TEXT,
          business_account_name TEXT,
          last_message TEXT,
          last_message_at TEXT,
          message_count INTEGER DEFAULT 0,
          real_data_synced BOOLEAN DEFAULT FALSE,
          real_sync_date TEXT,
          is_real_user BOOLEAN DEFAULT FALSE,
          chat_history_synced BOOLEAN DEFAULT FALSE,
          additional_data TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Messages table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          sender_name TEXT,
          sender_type TEXT NOT NULL,
          message_type TEXT DEFAULT 'text',
          content TEXT NOT NULL,
          platform TEXT NOT NULL,
          platform_message_id TEXT,
          status TEXT DEFAULT 'sent',
          read_at DATETIME,
          read_by TEXT,
          line_read_receipt_id TEXT,
          line_read_receipt_sent_at DATETIME,
          additional_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
      `);

      // Idempotency: avoid duplicate inserts from webhooks (platform + platform_message_id)
      this.db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_platform_message
        ON messages (platform, platform_message_id)
      `);

      console.log('✅ SQLite tables created');
    });
  }

  /**
   * Get users from storage
   */
  async getUsers() {
    if (this.storageStrategy === 'sqlite') {
      return this.getUsersFromSQLite();
    } else {
      return this.getUsersFromJSON();
    }
  }

  /**
   * Get users from SQLite
   */
  async getUsersFromSQLite() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          console.error('❌ SQLite users query failed:', err.message);
          // Fallback to JSON
          resolve(this.getUsersFromJSON());
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get users from JSON
   */
  async getUsersFromJSON() {
    try {
      if (fs.existsSync(this.jsonFiles.users)) {
        const data = fs.readFileSync(this.jsonFiles.users, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('❌ JSON users read failed:', error.message);
      return [];
    }
  }

  /**
   * Save user to storage
   */
  async saveUser(user) {
    if (this.storageStrategy === 'sqlite') {
      return this.saveUserToSQLite(user);
    } else {
      return this.saveUserToJSON(user);
    }
  }

  /**
   * Save user to SQLite
   */
  async saveUserToSQLite(user) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO users (
          id, platform_id, platform, name, display_name, profile_picture_url,
          status, status_message, language, last_seen, additional_data,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id, user.platform_id, user.platform, user.name, user.display_name,
        user.profile_picture_url, user.status, user.status_message, user.language,
        user.last_seen, JSON.stringify(user.additional_data || {}),
        user.created_at, user.updated_at
      ], function(err) {
        if (err) {
          console.error('❌ SQLite user save failed:', err.message);
          // Fallback to JSON
          resolve(this.saveUserToJSON(user));
        } else {
          resolve({ id: user.id, changes: this.changes });
        }
      });
    });
  }

  /**
   * Save user to JSON
   */
  async saveUserToJSON(user) {
    try {
      let users = await this.getUsersFromJSON();
      const existingIndex = users.findIndex(u => u.id === user.id);
      
      if (existingIndex >= 0) {
        users[existingIndex] = user;
      } else {
        users.push(user);
      }
      
      fs.writeFileSync(this.jsonFiles.users, JSON.stringify(users, null, 2));
      return { id: user.id, changes: 1 };
    } catch (error) {
      console.error('❌ JSON user save failed:', error.message);
      throw error;
    }
  }

  /**
   * Get conversations from storage
   */
  async getConversations() {
    if (this.storageStrategy === 'sqlite') {
      // Check if SQLite has any conversations
      const sqliteResult = await this.getConversationsFromSQLite();
      
      // If SQLite has no conversations, fallback to JSON
      if (sqliteResult.length === 0) {
        console.log(`📁 SQLite empty for conversations, falling back to JSON`);
        return this.getConversationsFromJSON();
      }
      
      return sqliteResult;
    } else {
      return this.getConversationsFromJSON();
    }
  }

  /**
   * Get conversations from SQLite
   */
  async getConversationsFromSQLite() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT c.*, u.display_name, u.profile_picture_url
        FROM conversations c
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY c.last_message_at DESC
      `, (err, rows) => {
        if (err) {
          console.error('❌ SQLite conversations query failed:', err.message);
          // Fallback to JSON
          resolve(this.getConversationsFromJSON());
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get conversations from JSON
   */
  async getConversationsFromJSON() {
    try {
      if (fs.existsSync(this.jsonFiles.conversations)) {
        const data = fs.readFileSync(this.jsonFiles.conversations, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('❌ JSON conversations read failed:', error.message);
      return [];
    }
  }

  /**
   * Save conversation to storage
   */
  async saveConversation(conversation) {
    if (this.storageStrategy === 'sqlite') {
      return this.saveConversationToSQLite(conversation);
    } else {
      return this.saveConversationToJSON(conversation);
    }
  }

  /**
   * Save conversation to SQLite
   */
  async saveConversationToSQLite(conversation) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO conversations (
          id, user_id, platform, platform_conversation_id, status,
          user_name, profile_picture_url, business_account_name,
          last_message, last_message_at, message_count,
          real_data_synced, real_sync_date, is_real_user,
          additional_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        conversation.id, conversation.user_id, conversation.platform,
        conversation.platform_conversation_id, conversation.status,
        conversation.user_name, conversation.profile_picture_url,
        conversation.business_account_name, conversation.last_message,
        conversation.last_message_at, conversation.message_count,
        conversation.real_data_synced, conversation.real_sync_date,
        conversation.is_real_user, JSON.stringify(conversation.additional_data || {}),
        conversation.created_at, conversation.updated_at
      ], function(err) {
        if (err) {
          console.error('❌ SQLite conversation save failed:', err.message);
          // Fallback to JSON
          resolve(this.saveConversationToJSON(conversation));
        } else {
          resolve({ id: conversation.id, changes: this.changes });
        }
      });
    });
  }

  /**
   * Save conversation to JSON
   */
  async saveConversationToJSON(conversation) {
    try {
      let conversations = await this.getConversationsFromJSON();
      const existingIndex = conversations.findIndex(c => c.id === conversation.id);
      
      if (existingIndex >= 0) {
        conversations[existingIndex] = conversation;
      } else {
        conversations.push(conversation);
      }
      
      fs.writeFileSync(this.jsonFiles.conversations, JSON.stringify(conversations, null, 2));
      return { id: conversation.id, changes: 1 };
    } catch (error) {
      console.error('❌ JSON conversation save failed:', error.message);
      throw error;
    }
  }

  /**
   * Get messages from storage
   */
  async getMessages(conversationId, options = {}) {
    const { limit = 100, offset = 0, order = 'ASC' } = options;
    
    if (this.storageStrategy === 'sqlite') {
      // Check if SQLite has any messages for this conversation
      const sqliteResult = await this.getMessagesFromSQLite(conversationId, { limit, offset, order });
      
      // If SQLite has no messages, fallback to JSON
      if (sqliteResult.messages.length === 0) {
        console.log(`📁 SQLite empty for ${conversationId}, falling back to JSON`);
        return this.getMessagesFromJSON(conversationId, { limit, offset, order });
      }
      
      return sqliteResult;
    } else {
      return this.getMessagesFromJSON(conversationId, { limit, offset, order });
    }
  }

  /**
   * Get messages from SQLite
   */
  async getMessagesFromSQLite(conversationId, options) {
    return new Promise((resolve, reject) => {
      const { limit, offset, order } = options;
      
      // Get total count
      this.db.get(
        'SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?',
        [conversationId],
        (err, countRow) => {
          if (err) {
            console.error('❌ SQLite messages count failed:', err.message);
            // Fallback to JSON
            resolve(this.getMessagesFromJSON(conversationId, options));
            return;
          }

          // Get messages
          this.db.all(
            `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ${order} LIMIT ? OFFSET ?`,
            [conversationId, limit, offset],
            (err, rows) => {
              if (err) {
                console.error('❌ SQLite messages query failed:', err.message);
                // Fallback to JSON
                resolve(this.getMessagesFromJSON(conversationId, options));
              } else {
                resolve({
                  messages: rows || [],
                  total: countRow.total,
                  hasMore: (offset + limit) < countRow.total
                });
              }
            }
          );
        }
      );
    });
  }

  /**
   * Get messages from JSON
   */
  async getMessagesFromJSON(conversationId, options) {
    try {
      const { limit, offset, order } = options;
      
      if (!fs.existsSync(this.jsonFiles.messages)) {
        return { messages: [], total: 0, hasMore: false };
      }

      const data = fs.readFileSync(this.jsonFiles.messages, 'utf8');
      const allMessages = JSON.parse(data);
      
      // Filter by conversation
      const conversationMessages = allMessages.filter(m => m.conversation_id === conversationId);
      
      // Sort
      conversationMessages.sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestamp).getTime();
        const timeB = new Date(b.created_at || b.timestamp).getTime();
        return order === 'ASC' ? timeA - timeB : timeB - timeA;
      });
      
      // Apply pagination
      const total = conversationMessages.length;
      const messages = conversationMessages.slice(offset, offset + limit);
      
      return {
        messages,
        total,
        hasMore: (offset + limit) < total
      };
    } catch (error) {
      console.error('❌ JSON messages read failed:', error.message);
      return { messages: [], total: 0, hasMore: false };
    }
  }

  /**
   * Save message to storage
   */
  async saveMessage(message) {
    try {
      // Always save to both SQLite and JSON for proper sync
      const sqliteResult = await this.saveMessageToSQLite(message);
      const jsonResult = await this.saveMessageToJSON(message);
      
      console.log(`💾 Message saved to both SQLite and JSON: ${message.id}`);
      return { id: message.id, changes: 1, synced: true };
    } catch (error) {
      console.error('❌ Message save failed:', error.message);
      throw error;
    }
  }

  /**
   * Save message to SQLite
   */
  async saveMessageToSQLite(message) {
    return new Promise((resolve, reject) => {
      // Use INSERT OR IGNORE to prevent duplicate overwrites
      // This ensures new messages are added, not replacing existing ones
      this.db.run(`
        INSERT OR IGNORE INTO messages (
          id, conversation_id, sender_id, sender_name, sender_type,
          message_type, content, platform, platform_message_id, status, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        message.id, message.conversation_id, message.sender_id,
        message.sender_name, message.sender_type, message.message_type,
        message.content, message.platform, message.platform_message_id || null,
        message.status, message.created_at, message.updated_at
      ], function(err) {
        if (err) {
          console.error('❌ SQLite message save failed:', err.message);
          // Fallback to JSON
          resolve(this.saveMessageToJSON(message));
        } else {
          // If this.changes === 0, message already existed (ignored)
          resolve({ id: message.id, changes: this.changes, isNew: this.changes > 0 });
        }
      });
    });
  }

  /**
   * Save message to JSON
   */
  async saveMessageToJSON(message) {
    try {
      let messages = [];
      if (fs.existsSync(this.jsonFiles.messages)) {
        const data = fs.readFileSync(this.jsonFiles.messages, 'utf8');
        messages = JSON.parse(data);
      }
      
      // Only add if message doesn't exist (prevent duplicates)
      const existingIndex = messages.findIndex(m => m.id === message.id);
      if (existingIndex === -1) {
        messages.push(message);
      } else {
        // Message already exists, don't replace it
        return { id: message.id, changes: 0, isNew: false };
      }
      
      fs.writeFileSync(this.jsonFiles.messages, JSON.stringify(messages, null, 2));
      return { id: message.id, changes: 1, isNew: true };
    } catch (error) {
      console.error('❌ JSON message save failed:', error.message);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const stats = {
      strategy: this.storageStrategy,
      isInitialized: this.isInitialized,
      timestamp: new Date().toISOString()
    };

    if (this.storageStrategy === 'sqlite') {
      try {
        const userCount = await this.getCount('users');
        const conversationCount = await this.getCount('conversations');
        const messageCount = await this.getCount('messages');
        
        stats.sqlite = {
          users: userCount,
          conversations: conversationCount,
          messages: messageCount
        };
      } catch (error) {
        stats.sqlite = { error: error.message };
      }
    } else {
      try {
        const users = await this.getUsersFromJSON();
        const conversations = await this.getConversationsFromJSON();
        const messages = await this.getMessagesFromJSON('all');
        
        stats.json = {
          users: users.length,
          conversations: conversations.length,
          messages: messages.total || 0
        };
      } catch (error) {
        stats.json = { error: error.message };
      }
    }

    return stats;
  }

  /**
   * Get message by platform and platform message ID
   */
  async getMessageByPlatformId(platform, platformMessageId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM messages WHERE platform = ? AND platform_message_id = ?',
        [platform, platformMessageId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  /**
   * Get count from SQLite table
   */
  async getCount(table) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('❌ Database close error:', err.message);
        } else {
          console.log('✅ Database connection closed');
        }
      });
    }
  }

  /**
   * Get message count for a conversation
   */
  async getConversationMessageCount(conversationId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?',
        [conversationId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row?.count || 0);
          }
        }
      );
    });
  }

  /**
   * Update conversation last message
   */
  async updateConversationLastMessage(conversationId, updateData) {
    return new Promise((resolve, reject) => {
      const { last_message, last_message_at, message_count } = updateData;
      
      this.db.run(
        'UPDATE conversations SET last_message = ?, last_message_at = ?, message_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [last_message, last_message_at, message_count, conversationId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: conversationId, changes: this.changes });
          }
        }
      );
    });
  }
}

// Export singleton instance
const dataStorage = new DataStorageService();
module.exports = dataStorage;
