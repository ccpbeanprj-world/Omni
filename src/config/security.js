// Security configuration and environment validation
const crypto = require('crypto');

class SecurityConfig {
  constructor() {
    this.validateEnvironment();
    this.generateSecurityKeys();
  }

  validateEnvironment() {
    const requiredEnvVars = [
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_CHANNEL_SECRET',
      'LINE_CHANNEL_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn('⚠️ Missing environment variables:', missingVars.join(', '));
      console.warn('⚠️ Some features may not work properly in production');
    }

    // Validate LINE credentials format
    if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      if (!process.env.LINE_CHANNEL_ACCESS_TOKEN.startsWith('Bearer ')) {
        console.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN should start with "Bearer "');
      }
    }

    if (process.env.LINE_CHANNEL_SECRET) {
      if (process.env.LINE_CHANNEL_SECRET.length < 32) {
        console.warn('⚠️ LINE_CHANNEL_SECRET should be at least 32 characters long');
      }
    }
  }

  generateSecurityKeys() {
    // Generate session secret if not provided
    if (!process.env.SESSION_SECRET) {
      process.env.SESSION_SECRET = crypto.randomBytes(64).toString('hex');
      console.log('🔐 Generated SESSION_SECRET for security');
    }

    // Generate API key if not provided
    if (!process.env.API_KEY) {
      process.env.API_KEY = crypto.randomBytes(32).toString('hex');
      console.log('🔑 Generated API_KEY for internal communication');
    }
  }

  // Security headers configuration
  getSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' ws: wss: https://api.line.me",
        "font-src 'self' https://fonts.gstatic.com data:",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    };
  }

  // Input validation patterns
  getValidationPatterns() {
    return {
      userId: /^[a-zA-Z0-9_-]{1,50}$/,
      messageId: /^[a-zA-Z0-9_-]{1,100}$/,
      conversationId: /^[a-zA-Z0-9_-]{1,100}$/,
      platform: /^(line|whatsapp|facebook|instagram|wechat|threads)$/,
      messageType: /^(text|image|video|audio|file|location|sticker)$/,
      status: /^(active|inactive|pending|blocked)$/
    };
  }

  // Sanitize input data
  sanitizeInput(data, type = 'general') {
    if (typeof data === 'string') {
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:/gi, '')
        .trim();
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item, type));
    }
    
    if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value, type);
      }
      return sanitized;
    }
    
    return data;
  }

  // Validate input against patterns
  validateInput(value, pattern) {
    const patterns = this.getValidationPatterns();
    const regex = patterns[pattern];
    
    if (!regex) {
      console.warn(`⚠️ Unknown validation pattern: ${pattern}`);
      return true;
    }
    
    return regex.test(value);
  }

  // Rate limiting configuration
  getRateLimitConfig() {
    return {
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000,
        message: 'Too many requests from this IP, please try again later.'
      },
      webhook: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 100,
        message: 'Too many webhook requests from this IP, please try again later.'
      },
      api: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 500,
        message: 'Too many API requests from this IP, please try again later.'
      }
    };
  }

  // Security audit logging
  logSecurityEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    };
    
    console.log('🔒 Security Event:', logEntry);
    
    // In production, you might want to send this to a security monitoring service
    // Example: sendToSecurityService(logEntry);
  }
}

module.exports = SecurityConfig;















