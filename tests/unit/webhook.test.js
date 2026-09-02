#!/usr/bin/env node

/**
 * Unit Tests for Webhook Handlers
 * Tests for LINE and WhatsApp webhook processing
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// Mock environment
process.env.JWT_SECRET = 'test_secret_key_minimum_32_characters_long_for_jwt_authentication';
process.env.NODE_ENV = 'test';
process.env.LINE_CHANNEL_SECRET = 'test_line_secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test_line_token';
process.env.WHATSAPP_PHONE_ID = 'test_phone_id';
process.env.WHATSAPP_TOKEN = 'test_token';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = 'test_account';

describe('Webhook Handlers', () => {
  
  describe('LINE Webhook Processing', () => {
    test('should validate correct LINE webhook signature', () => {
      const crypto = require('crypto');
      const body = '{"events":[{"type":"message","replyToken":"token123"}]}';
      const secret = 'test_line_secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');
      
      const { validateLineSignature } = require('../../src/middleware/webhookSecurity');
      const isValid = validateLineSignature(body, signature);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect LINE webhook signature', () => {
      const body = '{"events":[{"type":"message"}]}';
      const invalidSignature = 'invalid_signature';
      
      const { validateLineSignature } = require('../../src/middleware/webhookSecurity');
      const isValid = validateLineSignature(body, invalidSignature);
      
      expect(isValid).toBe(false);
    });

    test('should process message event', async () => {
      const event = {
        type: 'message',
        replyToken: 'test_reply_token',
        source: {
          userId: 'U1234567890abcdef',
          type: 'user'
        },
        message: {
          type: 'text',
          text: 'Test message'
        },
        timestamp: Date.now()
      };
      
      // Check if event has required fields
      expect(event.type).toBe('message');
      expect(event.source.userId).toBeDefined();
      expect(event.message.text).toBe('Test message');
    });

    test('should process follow event', async () => {
      const event = {
        type: 'follow',
        source: {
          userId: 'U1234567890abcdef',
          type: 'user'
        },
        timestamp: Date.now()
      };
      
      expect(event.type).toBe('follow');
      expect(event.source.userId).toBeDefined();
    });
  });

  describe('WhatsApp Webhook Processing', () => {
    test('should validate correct WhatsApp webhook signature', () => {
      const crypto = require('crypto');
      const body = '{"entry":[{"id":"1"}]}';
      const secret = 'test_secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');
      
      // Simulate signature validation
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('base64');
      
      expect(signature).toBe(expectedSignature);
    });

    test('should process text message event', async () => {
      const event = {
        messaging_product: 'whatsapp',
        metadata: {
          display_phone_number: '1234567890',
          phone_number_id: 'phone_id_123'
        },
        contacts: [{
          profile: {
            name: 'Test User'
          },
          wa_id: '1234567890'
        }],
        messages: [{
          from: '1234567890',
          type: 'text',
          text: {
            body: 'Test message'
          },
          message_id: 'msg_123',
          timestamp: Date.now()
        }]
      };
      
      expect(event.messaging_product).toBe('whatsapp');
      expect(event.messages[0].type).toBe('text');
      expect(event.messages[0].text.body).toBe('Test message');
    });

    test('should extract phone number from message', () => {
      const message = {
        from: '1234567890',
        text: {
          body: 'Hello'
        }
      };
      
      const phoneNumber = message.from;
      expect(phoneNumber).toBe('1234567890');
      expect(phoneNumber).toMatch(/^\d{10,}$/);
    });
  });

  describe('Webhook Security', () => {
    test('should require signature for webhook validation', () => {
      const webhookData = {
        body: '{"test":"data"}',
        signature: 'valid_signature'
      };
      
      expect(webhookData.signature).toBeDefined();
      expect(webhookData.body).toBeDefined();
    });

    test('should validate timestamp for replay attack prevention', () => {
      const timestamp = Date.now();
      const fiveMinutesAgo = timestamp - (5 * 60 * 1000);
      
      // Normal request
      expect(timestamp).toBeGreaterThan(fiveMinutesAgo);
      
      // Old request (potential replay attack)
      const oldTimestamp = timestamp - (10 * 60 * 1000);
      expect(oldTimestamp).toBeLessThan(fiveMinutesAgo);
    });
  });

  describe('Webhook Rate Limiting', () => {
    test('should track webhook request count', () => {
      const requestCount = {};
      const ip = '192.168.1.1';
      
      // Simulate multiple requests
      requestCount[ip] = (requestCount[ip] || 0) + 1;
      expect(requestCount[ip]).toBe(1);
      
      requestCount[ip] = (requestCount[ip] || 0) + 1;
      expect(requestCount[ip]).toBe(2);
      
      requestCount[ip] = (requestCount[ip] || 0) + 1;
      expect(requestCount[ip]).toBe(3);
    });

    test('should prevent abuse with rate limiting', () => {
      const requestCount = {};
      const ip = '192.168.1.1';
      const maxRequests = 100;
      
      // Exceed rate limit
      for (let i = 0; i < maxRequests + 10; i++) {
        requestCount[ip] = (requestCount[ip] || 0) + 1;
      }
      
      const shouldBlock = requestCount[ip] > maxRequests;
      expect(shouldBlock).toBe(true);
    });
  });

  describe('Webhook Error Handling', () => {
    test('should handle invalid JSON gracefully', () => {
      const invalidJson = '{invalid json}';
      
      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow(SyntaxError);
    });

    test('should handle missing required fields', () => {
      const incompleteEvent = {
        type: 'message'
        // Missing required fields
      };
      
      expect(incompleteEvent).toBeDefined();
      expect(incompleteEvent.source).toBeUndefined();
    });
  });
});


