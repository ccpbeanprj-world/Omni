#!/usr/bin/env node

/**
 * Security Middleware
 * Comprehensive security measures for the Omni-Channel Platform
 */

const validator = require('validator');
const xss = require('xss');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class SecurityMiddleware {
  constructor() {
    this.setupXSSProtection();
    this.setupRateLimiting();
    this.setupSecurityHeaders();
  }

  /**
   * XSS Protection Middleware
   */
  setupXSSProtection() {
    this.xssOptions = {
      whiteList: {
        // Allow only safe HTML tags
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
      css: false // Disable CSS to prevent CSS-based XSS
    };
  }

  /**
   * Sanitize input data
   */
  sanitizeInput(data) {
    if (typeof data === 'string') {
      // Remove potentially dangerous characters
      let sanitized = data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
      
      // Apply XSS filter
      sanitized = xss(sanitized, this.xssOptions);
      
      // Additional validation
      sanitized = validator.escape(sanitized);
      
      return sanitized.trim();
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Input validation middleware
   */
  validateInput(req, res, next) {
    try {
      // Sanitize body
      if (req.body) {
        req.body = this.sanitizeInput(req.body);
      }
      
      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeInput(req.query);
      }
      
      // Sanitize params
      if (req.params) {
        req.params = this.sanitizeInput(req.params);
      }
      
      next();
    } catch (error) {
      console.error('❌ Input validation error:', error);
      res.status(400).json({ 
        success: false, 
        error: 'Invalid input data',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Message content validation
   */
  validateMessageContent(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('Message content must be a non-empty string');
    }
    
    // Length validation
    if (content.length > 1000) {
      throw new Error('Message content too long (max 1000 characters)');
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<link/i,
      /<meta/i,
      /<style/i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new Error('Message content contains potentially dangerous content');
      }
    }
    
    return this.sanitizeInput(content);
  }

  /**
   * User ID validation
   */
  validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }
    
    // Check for valid format (alphanumeric, underscores, hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new Error('User ID contains invalid characters');
    }
    
    // Length validation
    if (userId.length > 100) {
      throw new Error('User ID too long (max 100 characters)');
    }
    
    return userId;
  }

  /**
   * Conversation ID validation
   */
  validateConversationId(conversationId) {
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('Conversation ID must be a non-empty string');
    }
    
    // Check for valid format (alphanumeric, underscores, hyphens, plus signs)
    if (!/^[a-zA-Z0-9_+-]+$/.test(conversationId)) {
      throw new Error('Conversation ID contains invalid characters');
    }
    
    // Length validation
    if (conversationId.length > 200) {
      throw new Error('Conversation ID too long (max 200 characters)');
    }
    
    return conversationId;
  }

  /**
   * Platform validation
   */
  validatePlatform(platform) {
    const allowedPlatforms = ['whatsapp', 'line', 'facebook', 'wechat'];
    
    if (!platform || typeof platform !== 'string') {
      throw new Error('Platform must be specified');
    }
    
    if (!allowedPlatforms.includes(platform.toLowerCase())) {
      throw new Error(`Invalid platform. Allowed: ${allowedPlatforms.join(', ')}`);
    }
    
    return platform.toLowerCase();
  }

  /**
   * Rate limiting setup
   */
  setupRateLimiting() {
    // General API rate limiting (RELAXED for normal usage)
    this.generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5000, // Limit each IP to 5000 requests per windowMs (increased from 1000)
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Message sending rate limiting (RELAXED for WhatsApp/LINE)
    this.messageLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 300, // Limit each IP to 300 messages per minute (increased from 60)
      message: {
        success: false,
        error: 'Message sending rate limit exceeded. Please slow down.',
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Webhook rate limiting (RELAXED)
    this.webhookLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 1000, // Limit webhook requests to 1000 per minute (increased from 200)
      message: {
        success: false,
        error: 'Webhook rate limit exceeded.',
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Security headers setup
   */
  setupSecurityHeaders() {
    this.securityHeaders = helmet({
      contentSecurityPolicy: {
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
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  /**
   * Get rate limiters
   */
  getRateLimiters() {
    return {
      general: this.generalLimiter,
      message: this.messageLimiter,
      webhook: this.webhookLimiter
    };
  }

  /**
   * Get security headers middleware
   */
  getSecurityHeaders() {
    return this.securityHeaders;
  }

  /**
   * Get input validation middleware
   */
  getInputValidation() {
    return this.validateInput.bind(this);
  }
}

module.exports = SecurityMiddleware;
