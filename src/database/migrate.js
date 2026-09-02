-- Migration script to move data from JSON files to PostgreSQL
-- This script reads existing JSON data and inserts it into PostgreSQL

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class DatabaseMigration {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'omni_platform',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });
    
    this.dataDir = path.join(__dirname, '..', 'data');
  }

  async migrate() {
    try {
      console.log('🚀 Starting database migration...');
      
      // Test database connection
      await this.testConnection();
      
      // Create schema
      await this.createSchema();
      
      // Migrate data
      await this.migrateUsers();
      await this.migrateConversations();
      await this.migrateMessages();
      
      console.log('✅ Database migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  async testConnection() {
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connection successful');
      client.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async createSchema() {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await this.pool.query(schema);
      console.log('✅ Database schema created successfully');
    } catch (error) {
      console.error('❌ Schema creation failed:', error.message);
      throw error;
    }
  }

  async migrateUsers() {
    try {
      const usersPath = path.join(this.dataDir, 'users.json');
      if (!fs.existsSync(usersPath)) {
        console.log('📝 No users.json found, skipping users migration');
        return;
      }

      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      console.log(`📊 Migrating ${users.length} users...`);

      for (const user of users) {
        const query = `
          INSERT INTO users (
            id, platform_id, platform, name, display_name, 
            profile_picture_url, status, status_message, 
            language, last_seen, additional_data, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (platform_id, platform) DO UPDATE SET
            name = EXCLUDED.name,
            display_name = EXCLUDED.display_name,
            profile_picture_url = EXCLUDED.profile_picture_url,
            status = EXCLUDED.status,
            status_message = EXCLUDED.status_message,
            language = EXCLUDED.language,
            last_seen = EXCLUDED.last_seen,
            additional_data = EXCLUDED.additional_data,
            updated_at = EXCLUDED.updated_at
        `;

        const values = [
          user.id || null,
          user.platform_user_id,
          user.platform,
          user.name,
          user.display_name,
          user.profile_picture_url,
          user.status || 'active',
          user.additionalData?.status_message || '',
          user.additionalData?.language || 'en',
          user.last_seen ? new Date(user.last_seen) : null,
          user.additionalData ? JSON.stringify(user.additionalData) : null,
          user.created_at ? new Date(user.created_at) : new Date(),
          user.updated_at ? new Date(user.updated_at) : new Date()
        ];

        await this.pool.query(query, values);
      }

      console.log(`✅ Migrated ${users.length} users successfully`);
    } catch (error) {
      console.error('❌ Users migration failed:', error.message);
      throw error;
    }
  }

  async migrateConversations() {
    try {
      const conversationsPath = path.join(this.dataDir, 'conversations.json');
      if (!fs.existsSync(conversationsPath)) {
        console.log('📝 No conversations.json found, skipping conversations migration');
        return;
      }

      const conversations = JSON.parse(fs.readFileSync(conversationsPath, 'utf8'));
      console.log(`📊 Migrating ${conversations.length} conversations...`);

      for (const conv of conversations) {
        // Get user_id from users table
        const userQuery = `
          SELECT id FROM users 
          WHERE platform_id = $1 AND platform = $2
        `;
        const userResult = await this.pool.query(userQuery, [conv.user_id, conv.platform]);
        
        if (userResult.rows.length === 0) {
          console.log(`⚠️ User not found for conversation ${conv.id}, skipping`);
          continue;
        }

        const query = `
          INSERT INTO conversations (
            id, user_id, platform, platform_conversation_id, status,
            user_name, profile_picture_url, business_account_name,
            last_message, last_message_at, message_count,
            real_data_synced, real_sync_date, is_real_user,
            additional_data, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            platform = EXCLUDED.platform,
            platform_conversation_id = EXCLUDED.platform_conversation_id,
            status = EXCLUDED.status,
            user_name = EXCLUDED.user_name,
            profile_picture_url = EXCLUDED.profile_picture_url,
            business_account_name = EXCLUDED.business_account_name,
            last_message = EXCLUDED.last_message,
            last_message_at = EXCLUDED.last_message_at,
            message_count = EXCLUDED.message_count,
            real_data_synced = EXCLUDED.real_data_synced,
            real_sync_date = EXCLUDED.real_sync_date,
            is_real_user = EXCLUDED.is_real_user,
            additional_data = EXCLUDED.additional_data,
            updated_at = EXCLUDED.updated_at
        `;

        const values = [
          conv.id || null,
          userResult.rows[0].id,
          conv.platform,
          conv.platform_conversation_id,
          conv.status || 'pending',
          conv.user_name,
          conv.profile_picture_url,
          conv.business_account_name,
          conv.last_message,
          conv.last_message_at ? new Date(conv.last_message_at) : null,
          conv.message_count || 0,
          conv.real_line_data_synced || false,
          conv.real_line_sync_date ? new Date(conv.real_line_sync_date) : null,
          conv.is_real_line_user || false,
          null, // additional_data
          conv.created_at ? new Date(conv.created_at) : new Date(),
          conv.updated_at ? new Date(conv.updated_at) : new Date()
        ];

        await this.pool.query(query, values);
      }

      console.log(`✅ Migrated ${conversations.length} conversations successfully`);
    } catch (error) {
      console.error('❌ Conversations migration failed:', error.message);
      throw error;
    }
  }

  async migrateMessages() {
    try {
      const messagesPath = path.join(this.dataDir, 'messages.json');
      if (!fs.existsSync(messagesPath)) {
        console.log('📝 No messages.json found, skipping messages migration');
        return;
      }

      const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
      console.log(`📊 Migrating ${messages.length} messages...`);

      for (const msg of messages) {
        // Get conversation_id from conversations table
        const convQuery = `
          SELECT id FROM conversations 
          WHERE id = $1
        `;
        const convResult = await this.pool.query(convQuery, [msg.conversation_id]);
        
        if (convResult.rows.length === 0) {
          console.log(`⚠️ Conversation not found for message ${msg.id}, skipping`);
          continue;
        }

        const query = `
          INSERT INTO messages (
            id, conversation_id, sender_id, sender_name, sender_type,
            message_type, content, platform, platform_message_id,
            status, read_at, read_by, line_read_receipt_id,
            line_read_receipt_sent_at, additional_data, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            conversation_id = EXCLUDED.conversation_id,
            sender_id = EXCLUDED.sender_id,
            sender_name = EXCLUDED.sender_name,
            sender_type = EXCLUDED.sender_type,
            message_type = EXCLUDED.message_type,
            content = EXCLUDED.content,
            platform = EXCLUDED.platform,
            platform_message_id = EXCLUDED.platform_message_id,
            status = EXCLUDED.status,
            read_at = EXCLUDED.read_at,
            read_by = EXCLUDED.read_by,
            line_read_receipt_id = EXCLUDED.line_read_receipt_id,
            line_read_receipt_sent_at = EXCLUDED.line_read_receipt_sent_at,
            additional_data = EXCLUDED.additional_data,
            updated_at = EXCLUDED.updated_at
        `;

        const values = [
          msg.id || null,
          convResult.rows[0].id,
          msg.sender_id,
          msg.sender_name,
          msg.sender_type,
          msg.message_type || 'text',
          msg.content,
          msg.platform,
          msg.platform_message_id,
          msg.status || 'sent',
          msg.read_at ? new Date(msg.read_at) : null,
          msg.read_by,
          msg.line_read_receipt_id,
          msg.line_read_receipt_sent_at ? new Date(msg.line_read_receipt_sent_at) : null,
          null, // additional_data
          msg.created_at ? new Date(msg.created_at) : new Date(),
          msg.updated_at ? new Date(msg.updated_at) : new Date()
        ];

        await this.pool.query(query, values);
      }

      console.log(`✅ Migrated ${messages.length} messages successfully`);
    } catch (error) {
      console.error('❌ Messages migration failed:', error.message);
      throw error;
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new DatabaseMigration();
  migration.migrate()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseMigration;






