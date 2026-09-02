#!/usr/bin/env node

/**
 * Security Configuration
 * Environment-based security settings
 */

require('dotenv').config();

const securityConfig = {
  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    key: process.env.ENCRYPTION_KEY || null // Should be set in production
  },

  // Rate limiting settings
  rateLimiting: {
    general: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 1000 // requests per window
    },
    message: {
      windowMs: parseInt(process.env.MESSAGE_RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute
      max: parseInt(process.env.MESSAGE_RATE_LIMIT_MAX) || 60 // messages per minute
    },
    webhook: {
      windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute
      max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 200 // webhooks per minute
    }
  },

  // XSS protection settings
  xssProtection: {
    enabled: process.env.XSS_PROTECTION_ENABLED !== 'false',
    whiteList: {
      p: [],
      br: [],
      strong: [],
      em: [],
      b: [],
      i: [],
      u: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
    css: false
  },

  // Input validation settings
  inputValidation: {
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 1000,
    maxUserIdLength: parseInt(process.env.MAX_USER_ID_LENGTH) || 100,
    maxConversationIdLength: parseInt(process.env.MAX_CONVERSATION_ID_LENGTH) || 200,
    allowedPlatforms: ['whatsapp', 'line', 'facebook', 'wechat']
  },

  // Audit logging settings
  auditLogging: {
    enabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
    logDirectory: process.env.AUDIT_LOG_DIRECTORY || './logs/audit',
    retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 30,
    logLevels: ['LOW', 'MEDIUM', 'HIGH'],
    categories: ['AUTHENTICATION', 'MESSAGE', 'SYSTEM', 'SECURITY', 'DATA_ACCESS']
  },

  // API versioning settings
  apiVersioning: {
    enabled: process.env.API_VERSIONING_ENABLED !== 'false',
    currentVersion: process.env.API_CURRENT_VERSION || 'v1',
    defaultVersion: process.env.API_DEFAULT_VERSION || 'v1',
    deprecatedVersions: (process.env.API_DEPRECATED_VERSIONS || '').split(',').filter(v => v),
    sunsetVersions: (process.env.API_SUNSET_VERSIONS || '').split(',').filter(v => v)
  },

  // Security headers settings
  securityHeaders: {
    contentSecurityPolicy: {
      enabled: process.env.CSP_ENABLED !== 'false',
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:", "https://api.line.me", "https://graph.facebook.com", "https://api.telegram.org"],
        mediaSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
        scriptSrcAttr: ["'none'"]
      }
    },
    hsts: {
      enabled: process.env.HSTS_ENABLED !== 'false',
      maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
      includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
      preload: process.env.HSTS_PRELOAD !== 'false'
    },
    noSniff: process.env.NO_SNIFF_ENABLED !== 'false',
    frameguard: {
      enabled: process.env.FRAMEGUARD_ENABLED !== 'false',
      action: process.env.FRAMEGUARD_ACTION || 'deny'
    },
    xssFilter: process.env.XSS_FILTER_ENABLED !== 'false',
    referrerPolicy: process.env.REFERRER_POLICY || 'strict-origin-when-cross-origin'
  },

  // CORS settings
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
    methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS').split(','),
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400 // 24 hours
  },

  // Authentication settings
  authentication: {
    jwtSecret: process.env.JWT_SECRET || null, // Should be set in production
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000 // 24 hours
  },

  // Webhook security settings
  webhookSecurity: {
    signatureVerification: process.env.WEBHOOK_SIGNATURE_VERIFICATION !== 'false',
    allowedIps: (process.env.WEBHOOK_ALLOWED_IPS || '').split(',').filter(ip => ip),
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 30000, // 30 seconds
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS) || 3
  },

  // Database security settings
  databaseSecurity: {
    connectionEncryption: process.env.DB_CONNECTION_ENCRYPTION !== 'false',
    queryLogging: process.env.DB_QUERY_LOGGING === 'true',
    parameterizedQueries: process.env.DB_PARAMETERIZED_QUERIES !== 'false',
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000
  },

  // Environment-specific settings
  environment: {
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test'
  }
};

/**
 * Validate security configuration
 */
function validateSecurityConfig() {
  const errors = [];

  // Check required environment variables
  if (securityConfig.environment.isProduction) {
    if (!securityConfig.encryption.key) {
      errors.push('ENCRYPTION_KEY must be set in production');
    }
    if (!securityConfig.authentication.jwtSecret) {
      errors.push('JWT_SECRET must be set in production');
    }
  }

  // Validate rate limiting settings
  if (securityConfig.rateLimiting.general.max <= 0) {
    errors.push('RATE_LIMIT_MAX must be greater than 0');
  }
  if (securityConfig.rateLimiting.message.max <= 0) {
    errors.push('MESSAGE_RATE_LIMIT_MAX must be greater than 0');
  }

  // Validate input validation settings
  if (securityConfig.inputValidation.maxMessageLength <= 0) {
    errors.push('MAX_MESSAGE_LENGTH must be greater than 0');
  }

  // Validate audit logging settings
  if (securityConfig.auditLogging.retentionDays <= 0) {
    errors.push('AUDIT_LOG_RETENTION_DAYS must be greater than 0');
  }

  // Validate CORS settings
  if (securityConfig.cors.origin.length === 0) {
    errors.push('CORS_ORIGINS must be specified');
  }

  if (errors.length > 0) {
    console.error('❌ Security configuration validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error('Invalid security configuration');
  }

  console.log('✅ Security configuration validated successfully');
}

/**
 * Get security configuration for specific environment
 */
function getSecurityConfig() {
  return securityConfig;
}

/**
 * Get security configuration for specific component
 */
function getComponentConfig(component) {
  return securityConfig[component] || {};
}

module.exports = {
  securityConfig,
  validateSecurityConfig,
  getSecurityConfig,
  getComponentConfig
};
