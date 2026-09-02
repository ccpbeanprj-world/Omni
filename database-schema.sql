-- Multi-Platform Omni-Channel Database Schema
-- Designed for scalability across multiple chat platforms

-- Business Accounts Table (Omni System Accounts)
CREATE TABLE business_accounts (
    id VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(50) NOT NULL, -- 'line', 'whatsapp', 'facebook', 'wechat', 'instagram', 'threads'
    platform_account_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    profile_picture_url TEXT,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
    access_token TEXT, -- Encrypted
    webhook_url TEXT,
    capabilities JSON, -- ['send_messages', 'receive_messages', 'user_profile_access', etc.]
    settings JSON, -- Platform-specific settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_platform_account (platform, platform_account_id),
    INDEX idx_platform (platform),
    INDEX idx_status (status)
);

-- Users Table (Real Users from Different Platforms)
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    platform_id VARCHAR(255) NOT NULL, -- Platform-specific user ID
    platform VARCHAR(50) NOT NULL, -- 'line', 'whatsapp', 'facebook', 'wechat', 'instagram', 'threads'
    
    -- Basic Profile Info
    name VARCHAR(255),
    display_name VARCHAR(255),
    profile_picture_url TEXT,
    status_message TEXT,
    language VARCHAR(10) DEFAULT 'en',
    
    -- Enhanced Profile Info
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP,
    has_rich_menu BOOLEAN DEFAULT FALSE,
    rich_menu_id VARCHAR(255),
    
    -- Group Info (for platforms that support groups)
    group_id VARCHAR(255),
    group_display_name VARCHAR(255),
    
    -- Business Account Relationship
    business_account_id VARCHAR(255) NOT NULL,
    business_account_name VARCHAR(255),
    business_account_platform VARCHAR(50),
    
    -- Contact Info (platform-specific)
    phone_number VARCHAR(50),
    email VARCHAR(255),
    username VARCHAR(255), -- Platform-specific username
    
    -- Metadata
    source_type VARCHAR(50) DEFAULT 'user', -- 'user', 'group', 'room'
    contact_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (business_account_id) REFERENCES business_accounts(id),
    UNIQUE KEY unique_platform_user (platform, platform_id),
    INDEX idx_platform (platform),
    INDEX idx_business_account (business_account_id),
    INDEX idx_online_status (is_online),
    INDEX idx_last_seen (last_seen)
);

-- Conversations Table
CREATE TABLE conversations (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    platform_conversation_id VARCHAR(255), -- Platform-specific conversation ID
    
    -- Conversation Info
    user_name VARCHAR(255),
    profile_picture_url TEXT,
    last_message TEXT,
    last_message_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'pending', 'closed', 'archived'
    
    -- Business Account Info
    business_account_id VARCHAR(255) NOT NULL,
    business_account_name VARCHAR(255),
    
    -- Conversation Metadata
    message_count INT DEFAULT 0,
    unread_count INT DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    tags JSON, -- ['support', 'sales', 'complaint', etc.]
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (business_account_id) REFERENCES business_accounts(id),
    INDEX idx_user_id (user_id),
    INDEX idx_platform (platform),
    INDEX idx_status (status),
    INDEX idx_last_message_at (last_message_at),
    INDEX idx_business_account (business_account_id)
);

-- Messages Table
CREATE TABLE messages (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    platform_message_id VARCHAR(255), -- Platform-specific message ID
    
    -- Message Content
    sender_id VARCHAR(255) NOT NULL,
    sender_type VARCHAR(50) NOT NULL, -- 'user', 'business_account', 'system'
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'video', 'audio', 'file', 'sticker', 'location'
    
    -- Media Info
    media_url TEXT,
    media_type VARCHAR(100),
    media_size BIGINT,
    thumbnail_url TEXT,
    
    -- Message Status
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    timestamp TIMESTAMP NOT NULL,
    
    -- Platform Info
    platform VARCHAR(50) NOT NULL,
    business_account_id VARCHAR(255) NOT NULL,
    
    -- Enhanced Data for Real-time Display
    user_name VARCHAR(255),
    user_profile_picture TEXT,
    business_account_name VARCHAR(255),
    
    -- Reply/Thread Info
    reply_to_message_id VARCHAR(255),
    thread_id VARCHAR(255),
    
    -- Platform-specific Data
    platform_data JSON, -- Store platform-specific metadata
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (business_account_id) REFERENCES business_accounts(id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_platform (platform),
    INDEX idx_timestamp (timestamp),
    INDEX idx_status (status),
    INDEX idx_business_account (business_account_id)
);

-- Message Read Receipts Table
CREATE TABLE message_read_receipts (
    id VARCHAR(255) PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_message_user (message_id, user_id),
    INDEX idx_message_id (message_id),
    INDEX idx_user_id (user_id)
);

-- Webhook Events Table (for audit and replay)
CREATE TABLE webhook_events (
    id VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP NULL,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_platform (platform),
    INDEX idx_event_type (event_type),
    INDEX idx_processed (processed),
    INDEX idx_created_at (created_at)
);

-- Platform Settings Table (for platform-specific configurations)
CREATE TABLE platform_settings (
    id VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    business_account_id VARCHAR(255) NOT NULL,
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (business_account_id) REFERENCES business_accounts(id),
    UNIQUE KEY unique_platform_setting (platform, business_account_id, setting_key),
    INDEX idx_platform (platform),
    INDEX idx_business_account (business_account_id)
);

-- Sync Status Table (for tracking sync operations)
CREATE TABLE sync_status (
    id VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    business_account_id VARCHAR(255) NOT NULL,
    sync_type VARCHAR(100) NOT NULL, -- 'contacts', 'messages', 'conversations'
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    records_synced INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (business_account_id) REFERENCES business_accounts(id),
    UNIQUE KEY unique_platform_sync (platform, business_account_id, sync_type),
    INDEX idx_platform (platform),
    INDEX idx_sync_status (sync_status),
    INDEX idx_last_sync_at (last_sync_at)
);

-- Insert default Omni Business Account
INSERT INTO business_accounts (
    id, platform, platform_account_id, name, display_name, description,
    profile_picture_url, status, capabilities, settings
) VALUES (
    'omni_business_account',
    'line',
    'your_line_channel_id_here',
    'Omni Business Account',
    'OmniChat System',
    'Omni-Channel Platform Business Account',
    'https://via.placeholder.com/150/4CAF50/FFFFFF?text=OMNI',
    'active',
    '["send_messages", "receive_messages", "user_profile_access", "rich_menu", "webhook_events"]',
    '{"auto_reply_enabled": true, "auto_reply_message": "Hello! I\'m here to help you.", "business_hours": "24/7", "language": "en"}'
);












