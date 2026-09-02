-- PostgreSQL Schema for Omni-Channel Platform
-- Migration from JSON files to PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    display_name VARCHAR(255),
    profile_picture_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    status_message TEXT,
    language VARCHAR(10) DEFAULT 'en',
    last_seen TIMESTAMP,
    additional_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    UNIQUE(platform_id, platform)
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_conversation_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    user_name VARCHAR(255),
    profile_picture_url TEXT,
    business_account_name VARCHAR(255),
    last_message TEXT,
    last_message_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    real_data_synced BOOLEAN DEFAULT FALSE,
    real_sync_date TIMESTAMP,
    is_real_user BOOLEAN DEFAULT FALSE,
    additional_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_conversations_user_id (user_id),
    INDEX idx_conversations_platform (platform),
    INDEX idx_conversations_status (status)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
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
    
    -- Indexes for performance
    INDEX idx_messages_conversation_id (conversation_id),
    INDEX idx_messages_sender_id (sender_id),
    INDEX idx_messages_platform (platform),
    INDEX idx_messages_created_at (created_at)
);

-- Message queue table for RabbitMQ integration
CREATE TABLE IF NOT EXISTS message_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_message_queue_status (status),
    INDEX idx_message_queue_platform (platform),
    INDEX idx_message_queue_created_at (created_at)
);

-- Platform configurations table
CREATE TABLE IF NOT EXISTS platform_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) UNIQUE NOT NULL,
    config_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default platform configurations
INSERT INTO platform_configs (platform, config_data) VALUES 
('line', '{"api_url": "https://api.line.me/v2/bot", "webhook_url": "/webhook/line", "enabled": true}'),
('whatsapp', '{"api_url": "https://graph.facebook.com/v18.0", "webhook_url": "/webhook/whatsapp", "enabled": false}'),
('facebook', '{"api_url": "https://graph.facebook.com/v18.0", "webhook_url": "/webhook/facebook", "enabled": false}'),
('wechat', '{"api_url": "https://api.weixin.qq.com", "webhook_url": "/webhook/wechat", "enabled": false}')
ON CONFLICT (platform) DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_platform_configs_updated_at BEFORE UPDATE ON platform_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();






