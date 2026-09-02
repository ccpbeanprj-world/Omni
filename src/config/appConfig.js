/**
 * Centralized Configuration Management
 * Handles all application configuration in one place
 */

const path = require('path');
require('dotenv').config();

class ConfigManager {
  constructor() {
    this.config = {};
    this.loadConfiguration();
  }

  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  loadConfiguration() {
    this.config = {
      // Server Configuration
      server: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || 'localhost',
        cors: {
          origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
          credentials: process.env.CORS_CREDENTIALS === 'true'
        },
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
          max: parseInt(process.env.RATE_LIMIT_MAX || '100')
        }
      },

      // Database Configuration
      database: {
        sqlite: {
          path: process.env.SQLITE_PATH || './omni.db'
        },
        postgresql: {
          host: process.env.PG_HOST || 'localhost',
          port: parseInt(process.env.PG_PORT || '5432'),
          database: process.env.PG_DATABASE || 'omni',
          user: process.env.PG_USER || 'postgres',
          password: process.env.PG_PASSWORD || '',
          ssl: process.env.PG_SSL === 'true'
        }
      },

      // Platform Configuration
      platforms: {
        line: {
          channelSecret: process.env.LINE_CHANNEL_SECRET || '',
          channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
          pollingInterval: parseInt(process.env.LINE_POLLING_INTERVAL || '2000'),
          webhookUrl: process.env.LINE_WEBHOOK_URL || ''
        },
        whatsapp: {
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
          webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''
        },
        facebook: {
          accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
          appSecret: process.env.FACEBOOK_APP_SECRET || '',
          pageId: process.env.FACEBOOK_PAGE_ID || ''
        },
        telegram: {
          botToken: process.env.TELEGRAM_BOT_TOKEN || '',
          webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || ''
        }
      },

      // Real-time Configuration
      realtime: {
        pollingIntervals: {
          realUserCheck: parseInt(process.env.REAL_USER_POLLING_INTERVAL || '2000'),
          fallbackCheck: parseInt(process.env.FALLBACK_POLLING_INTERVAL || '5000'),
          healthCheck: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000')
        },
        socketIO: {
          reconnectionAttempts: parseInt(process.env.SOCKET_RECONNECTION_ATTEMPTS || '5'),
          reconnectionDelay: parseInt(process.env.SOCKET_RECONNECTION_DELAY || '1000'),
          timeout: parseInt(process.env.SOCKET_TIMEOUT || '20000')
        }
      },

      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: {
          enabled: process.env.LOG_FILE_ENABLED === 'true',
          path: process.env.LOG_FILE_PATH || './logs',
          maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
          maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5')
        },
        console: {
          enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
          format: process.env.LOG_CONSOLE_FORMAT || 'simple'
        }
      },

      // Environment
      environment: process.env.NODE_ENV || 'development',
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production'
    };

    this.validateConfiguration();
  }

  validateConfiguration() {
    const requiredEnvVars = [
      'LINE_CHANNEL_SECRET',
      'LINE_CHANNEL_ACCESS_TOKEN'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`⚠️ Missing required environment variables: ${missingVars.join(', ')}`);
      console.warn('⚠️ Some features may not work properly');
    }

    // Validate LINE configuration
    if (!this.config.platforms.line.channelSecret || !this.config.platforms.line.channelAccessToken) {
      console.warn('⚠️ LINE platform configuration incomplete');
    }

    // Validate database configuration
    if (this.config.database.postgresql.password === '') {
      console.warn('⚠️ PostgreSQL password not set, using empty password');
    }
  }

  // Getters for different configuration sections
  getServerConfig() {
    return this.config.server;
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getPlatformConfig() {
    return this.config.platforms;
  }

  getRealtimeConfig() {
    return this.config.realtime;
  }

  getLoggingConfig() {
    return this.config.logging;
  }

  getEnvironment() {
    return this.config.environment;
  }

  isDevelopment() {
    return this.config.isDevelopment;
  }

  isProduction() {
    return this.config.isProduction;
  }

  // Get specific platform configuration
  getLineConfig() {
    return this.config.platforms.line;
  }

  getWhatsAppConfig() {
    return this.config.platforms.whatsapp;
  }

  getFacebookConfig() {
    return this.config.platforms.facebook;
  }

  getTelegramConfig() {
    return this.config.platforms.telegram;
  }

  // Get specific database configuration
  getSQLiteConfig() {
    return this.config.database.sqlite;
  }

  getPostgreSQLConfig() {
    return this.config.database.postgresql;
  }

  // Update configuration at runtime
  updateConfig(section, updates) {
    if (this.config[section]) {
      this.config[section] = { ...this.config[section], ...updates };
      console.log(`✅ Configuration updated for section: ${section}`);
    } else {
      console.warn(`⚠️ Configuration section '${section}' not found`);
    }
  }

  // Get all configuration (for debugging)
  getAllConfig() {
    return { ...this.config };
  }

  // Get configuration summary (safe for logging)
  getConfigSummary() {
    return {
      server: {
        port: this.config.server.port,
        host: this.config.server.host,
        environment: this.config.environment
      },
      platforms: {
        line: {
          configured: !!(this.config.platforms.line.channelSecret && this.config.platforms.line.channelAccessToken),
          pollingInterval: this.config.platforms.line.pollingInterval
        },
        whatsapp: {
          configured: !!(this.config.platforms.whatsapp.accessToken)
        },
        facebook: {
          configured: !!(this.config.platforms.facebook.accessToken)
        },
        telegram: {
          configured: !!(this.config.platforms.telegram.botToken)
        }
      },
      database: {
        sqlite: {
          path: this.config.database.sqlite.path
        },
        postgresql: {
          configured: !!(this.config.database.postgresql.password)
        }
      },
      realtime: {
        pollingIntervals: this.config.realtime.pollingIntervals,
        socketIO: this.config.realtime.socketIO
      },
      logging: {
        level: this.config.logging.level,
        fileEnabled: this.config.logging.file.enabled,
        consoleEnabled: this.config.logging.console.enabled
      }
    };
  }
}

// Export singleton instance
const config = ConfigManager.getInstance();
module.exports = config;
