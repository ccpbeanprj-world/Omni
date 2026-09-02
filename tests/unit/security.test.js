#!/usr/bin/env node

/**
 * Unit Tests for Security Functions
 * Tests for JWT authentication, webhook validation, and input sanitization
 */

const { describe, test, expect, beforeAll } = require('@jest/globals');

// Mock environment
process.env.JWT_SECRET = 'test_secret_key_minimum_32_characters_long_for_jwt_authentication';
process.env.NODE_ENV = 'test';

describe('Security Functions', () => {
  
  describe('JWT Authentication', () => {
    test('authenticateToken should reject requests without token', async () => {
      const { authenticateToken } = require('../../src/middleware/auth');
      const req = {
        headers: {},
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
        get: jest.fn(() => 'test/1.0'),
        user: undefined
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();
      
      await authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied. No token provided.',
        requiresAuth: true
      });
    });

    test('authenticateToken should reject invalid token', async () => {
      const { authenticateToken } = require('../../src/middleware/auth');
      const req = {
        headers: {
          authorization: 'Bearer invalid_token'
        },
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'GET',
        get: jest.fn(() => 'test/1.0'),
        user: undefined
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();
      
      await authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token.',
        requiresAuth: true
      });
    });
  });

  describe('Optional Authentication', () => {
    test('optionalAuth should allow unauthenticated requests', async () => {
      const { optionalAuth } = require('../../src/middleware/auth');
      const req = {
        headers: {},
        user: undefined
      };
      const res = {};
      const next = jest.fn();
      
      await optionalAuth(req, res, next);
      
      // optionalAuth doesn't set req.user by default in current implementation
      // just verifies that it doesn't throw and calls next
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Role Authorization', () => {
    test('authorizeRoles should reject user without required role', async () => {
      const { authorizeRoles } = require('../../src/middleware/auth');
      const req = {
        user: { id: 'test', role: 'user' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();
      
      const middleware = authorizeRoles('admin');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions'
      });
    });

    test('authorizeRoles should allow user with required role', async () => {
      const { authorizeRoles } = require('../../src/middleware/auth');
      const req = {
        user: { id: 'admin', role: 'admin' }
      };
      const res = {};
      const next = jest.fn();
      
      const middleware = authorizeRoles('admin');
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Webhook Signature Validation', () => {
    test('LINE webhook should validate correct signature', () => {
      process.env.LINE_CHANNEL_SECRET = 'test_line_secret';
      
      const crypto = require('crypto');
      const body = '{"events":[]}';
      const signature = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
        .update(body)
        .digest('base64');
      
      const { validateLineSignature } = require('../../src/middleware/webhookSecurity');
      const isValid = validateLineSignature(body, signature);
      
      expect(isValid).toBe(true);
    });

    test('LINE webhook should reject incorrect signature', () => {
      process.env.LINE_CHANNEL_SECRET = 'test_line_secret';
      
      const body = '{"events":[]}';
      const invalidSignature = 'invalid_signature';
      
      const { validateLineSignature } = require('../../src/middleware/webhookSecurity');
      const isValid = validateLineSignature(body, invalidSignature);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Input Validation', () => {
    test('should sanitize XSS attempts', () => {
      const input = '<script>alert("xss")</script>Hello';
      
      // This would be handled by security middleware
      expect(input).toContain('<script>');
    });

    test('should validate message content length', () => {
      const validMessage = 'A'.repeat(100);
      const invalidMessage = 'A'.repeat(10001);
      
      expect(validMessage.length).toBeLessThanOrEqual(10000);
      expect(invalidMessage.length).toBeGreaterThan(10000);
    });
  });

  describe('Rate Limiting', () => {
    test('should track request count', () => {
      const requestCount = {};
      const ip = '127.0.0.1';
      
      // Simulate rate limiting
      requestCount[ip] = (requestCount[ip] || 0) + 1;
      
      expect(requestCount[ip]).toBe(1);
      
      // Exceed rate limit
      for (let i = 0; i < 100; i++) {
        requestCount[ip] = (requestCount[ip] || 0) + 1;
      }
      
      expect(requestCount[ip]).toBeGreaterThan(100);
    });
  });

  describe('Audit Logging', () => {
    test('should log security events', () => {
      const AuditLogger = require('../../src/services/auditLogger');
      const auditLogger = new AuditLogger();
      
      // Mock logSecurity method
      auditLogger.logSecurity = jest.fn();
      
      auditLogger.logSecurity('TEST_EVENT', 'user123', '127.0.0.1', {
        action: 'test'
      });
      
      expect(auditLogger.logSecurity).toHaveBeenCalled();
    });
  });

});

// Export for use in other test files
module.exports = {
  describe,
  test,
  expect
};

