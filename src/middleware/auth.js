#!/usr/bin/env node

/**
 * JWT Authentication Middleware
 * Secures API endpoints with token-based authentication
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AuditLogger = require('../services/auditLogger');

const auditLogger = new AuditLogger();

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and attaches user to request
 */
function authenticateToken(req, res, next) {
  try {
    // Skip authentication for public endpoints
    const publicPaths = [
      '/api/health',
      '/webhook/line',
      '/webhook/whatsapp',
      '/webhook/facebook',
      '/webhook/instagram',
      '/webhook/wechat'
    ];

    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      auditLogger.logSecurity('AUTH_FAILED_NO_TOKEN', req.user?.id || 'anonymous', req.ip, {
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({ 
        success: false,
        error: 'Access denied. No token provided.',
        requiresAuth: true
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_in_production', (err, user) => {
      if (err) {
        auditLogger.logSecurity('AUTH_FAILED_INVALID_TOKEN', req.user?.id || 'anonymous', req.ip, {
          path: req.path,
          method: req.method,
          error: err.message
        });

        return res.status(403).json({ 
          success: false,
          error: 'Invalid or expired token.',
          requiresAuth: true
        });
      }

      // Attach user to request
      req.user = user;
      
      auditLogger.logAuthentication('TOKEN_VALIDATED', user.id, req.ip, req.get('User-Agent'), true, {
        path: req.path,
        method: req.method
      });

      next();
    });
  } catch (error) {
    logger.error('Authentication middleware error', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal authentication error' 
    });
  }
}

/**
 * Generate JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || 'user',
    platform: user.platform
  };

  return jwt.sign(
    payload, 
    process.env.JWT_SECRET || 'default_secret_change_in_production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_in_production', (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }

  next();
}

/**
 * Role-based access control
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      auditLogger.logSecurity('UNAUTHORIZED_ACCESS', req.user.id, req.ip, {
        path: req.path,
        method: req.method,
        userRole: req.user.role,
        requiredRoles: allowedRoles
      });

      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions' 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  generateToken,
  optionalAuth,
  authorizeRoles
};

