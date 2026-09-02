const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * Enhanced Security Headers Configuration
 * Provides comprehensive security headers for production deployment
 */
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite dev server
        "'unsafe-eval'", // Required for React development
        "https://cdn.jsdelivr.net",
        "https://unpkg.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        "https://api.line.me",
        "https://graph.facebook.com",
        "https://api.telegram.org"
      ],
      mediaSrc: [
        "'self'",
        "data:",
        "blob:"
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Permissions Policy
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: []
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled for development
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: {
    policy: 'same-origin'
  },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  }
});

/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP to HTTPS in production
 */
const httpsEnforcement = (req, res, next) => {
  // Skip HTTPS enforcement in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // Check if request is secure (HTTPS)
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    const httpsUrl = `https://${req.get('host')}${req.url}`;
    
    logger.warn('HTTPS enforcement: Redirecting HTTP to HTTPS', {
      originalUrl: req.url,
      redirectUrl: httpsUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.redirect(301, httpsUrl);
  }
  
  next();
};

/**
 * Additional Security Headers
 * Custom headers for enhanced security
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Add security headers for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
  
  next();
};

/**
 * Security Audit Logging
 * Logs security-related events
 */
const securityAuditLogging = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Log security-relevant events
    if (res.statusCode >= 400) {
      logger.warn('Security event detected', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log authentication attempts
    if (req.path.includes('/auth/') || req.path.includes('/login')) {
      logger.info('Authentication attempt', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
    
    // Log webhook events
    if (req.path.includes('/webhook/')) {
      logger.info('Webhook request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  next();
};

/**
 * Environment Security Validation
 * Validates security configuration in production
 */
const validateSecurityConfig = () => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'LINE_CHANNEL_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required security environment variables', {
      missingVars: missingVars,
      environment: process.env.NODE_ENV
    });
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required security environment variables: ${missingVars.join(', ')}`);
    }
  }
  
  // Validate JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET is too short for production use', {
      length: process.env.JWT_SECRET.length,
      environment: process.env.NODE_ENV
    });
  }
  
  // Validate LINE channel secret strength
  if (process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_SECRET.length < 32) {
    logger.warn('LINE_CHANNEL_SECRET is too short for production use', {
      length: process.env.LINE_CHANNEL_SECRET.length,
      environment: process.env.NODE_ENV
    });
  }
  
  logger.info('Security configuration validated', {
    environment: process.env.NODE_ENV,
    httpsEnforcement: process.env.NODE_ENV === 'production',
    cspEnabled: true,
    hstsEnabled: process.env.NODE_ENV === 'production'
  });
};

module.exports = {
  securityHeaders,
  httpsEnforcement,
  additionalSecurityHeaders,
  securityAuditLogging,
  validateSecurityConfig
};


