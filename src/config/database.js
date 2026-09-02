const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const connectDatabase = async () => {
  try {
        pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
          // Add retry logic for connection issues
          retryDelayMs: 1000,
          retryAttempts: 3
        });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('✅ Database connected successfully');
    
    // Initialize database schema
    await initializeSchema();
    
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

const initializeSchema = async () => {
  const client = await pool.connect();
  
  try {
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        platform_id VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        profile_picture_url TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform_id, platform)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        platform VARCHAR(50) NOT NULL,
        platform_conversation_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        assigned_agent_id INTEGER,
        labels TEXT[],
        metadata JSONB,
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id),
        platform_message_id VARCHAR(255),
        sender_type VARCHAR(20) NOT NULL, -- 'user' or 'agent'
        sender_id INTEGER,
        content TEXT,
        message_type VARCHAR(50) DEFAULT 'text',
        media_url TEXT,
        media_type VARCHAR(50),
        metadata JSONB,
        status VARCHAR(50) DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'agent',
        status VARCHAR(50) DEFAULT 'active',
        max_conversations INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_platform 
      ON users(platform, platform_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user 
      ON conversations(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_events_processed 
      ON webhook_events(processed, created_at);
    `);

    logger.info('✅ Database schema initialized');
    
  } catch (error) {
    logger.error('❌ Failed to initialize database schema:', error);
    throw error;
  } finally {
    client.release();
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
};

const query = async (text, params) => {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Database query error:', { text, error: error.message });
    throw error;
  }
};

module.exports = {
  connectDatabase,
  getPool,
  query
};

