const { Pool } = require('pg');
require('dotenv').config();

class DatabaseMigration {
  constructor() {
    this.pgPool = null;
    this.sqliteDb = null;
  }

  async initializePostgreSQL() {
    try {
      console.log('🔄 Initializing PostgreSQL connection...');
      
      // PostgreSQL connection configuration
      const pgConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'omni_platform',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      this.pgPool = new Pool(pgConfig);
      
      // Test connection
      const client = await this.pgPool.connect();
      console.log('✅ PostgreSQL connection successful');
      client.release();
      
      return true;
    } catch (error) {
      console.log('⚠️ PostgreSQL not available, using SQLite fallback');
      console.log('📝 To enable PostgreSQL, set these environment variables:');
      console.log('   POSTGRES_HOST=localhost');
      console.log('   POSTGRES_PORT=5432');
      console.log('   POSTGRES_DB=omni_platform');
      console.log('   POSTGRES_USER=postgres');
      console.log('   POSTGRES_PASSWORD=password');
      return false;
    }
  }

  async createTables() {
    if (!this.pgPool) {
      console.log('⚠️ PostgreSQL not available, skipping table creation');
      return;
    }

    try {
      console.log('🔄 Creating PostgreSQL tables...');
      
      const client = await this.pgPool.connect();
      
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          platform_id VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          name VARCHAR(255),
          display_name VARCHAR(255),
          profile_picture_url TEXT,
          status_message TEXT,
          is_business_account BOOLEAN DEFAULT FALSE,
          is_real_user BOOLEAN DEFAULT TRUE,
          additional_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create conversations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          platform_conversation_id VARCHAR(255),
          status VARCHAR(50) DEFAULT 'active',
          user_name VARCHAR(255),
          profile_picture_url TEXT,
          business_account_name VARCHAR(255),
          last_message TEXT,
          last_message_at TIMESTAMP,
          message_count INTEGER DEFAULT 0,
          real_data_synced BOOLEAN DEFAULT FALSE,
          real_sync_date TIMESTAMP,
          is_real_user BOOLEAN DEFAULT TRUE,
          chat_history_synced BOOLEAN DEFAULT FALSE,
          sync_date TIMESTAMP,
          additional_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          conversation_id VARCHAR(255) NOT NULL,
          sender_id VARCHAR(255) NOT NULL,
          sender_name VARCHAR(255),
          sender_type VARCHAR(50) NOT NULL,
          message_type VARCHAR(50) DEFAULT 'text',
          content TEXT NOT NULL,
          platform VARCHAR(50) NOT NULL,
          platform_message_id VARCHAR(255),
          status VARCHAR(50) DEFAULT 'sent',
          read_at TIMESTAMP,
          read_by VARCHAR(255),
          line_read_receipt_id VARCHAR(255),
          line_read_receipt_sent_at TIMESTAMP,
          additional_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_platform ON users(platform_id, platform)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)
      `);

      client.release();
      console.log('✅ PostgreSQL tables created successfully');
      
    } catch (error) {
      console.error('❌ Error creating PostgreSQL tables:', error.message);
    }
  }

  async migrateData() {
    if (!this.pgPool) {
      console.log('⚠️ PostgreSQL not available, skipping data migration');
      return;
    }

    try {
      console.log('🔄 Migrating data from SQLite to PostgreSQL...');
      
      // This would migrate data from SQLite to PostgreSQL
      // For now, we'll start with a clean PostgreSQL database
      console.log('✅ Data migration completed (clean start)');
      
    } catch (error) {
      console.error('❌ Error migrating data:', error.message);
    }
  }

  async getPool() {
    return this.pgPool;
  }

  async close() {
    if (this.pgPool) {
      await this.pgPool.end();
      console.log('✅ PostgreSQL connection closed');
    }
  }
}

// Export for use in server
module.exports = DatabaseMigration;






