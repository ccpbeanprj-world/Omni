#!/usr/bin/env node

/**
 * Webhook Security Middleware
 * Validates webhook signatures for all platforms
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const AuditLogger = require('../services/auditLogger');

const auditLogger = new AuditLogger();

/**
 * LINE Webhook Signature Validation
 */
function validateLineSignature(body, signature) {
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    
    if (!channelSecret) {
      logger.warn('⚠️ LINE_CHANNEL_SECRET not configured');
      return false;
    }

    if (!signature) {
      logger.warn('⚠️ No signature provided for LINE webhook');
      return false;
    }

    // LINE uses HMAC-SHA256
    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(body)
      .digest('base64');

    const isValid = hash === signature;
    
    if (!isValid) {
      auditLogger.logSecurity('LINE_WEBHOOK_SIGNATURE_MISMATCH', 'webhook', 'unknown', {
        expectedSignature: hash.substring(0, 20) + '...',
        providedSignature: signature.substring(0, 20) + '...',
        bodyLength: body?.length || 0
      });
    }

    return isValid;
  } catch (error) {
    logger.error('LINE webhook signature validation error:', error);
    return false;
  }
}

/**
 * WhatsApp Webhook Signature Validation (Twilio)
 */
function validateWhatsAppSignature(url, params, signature) {
  try {
    // Skip validation in development/sandbox mode
    if (process.env.NODE_ENV === 'development' || process.env.TWILIO_SANDBOX_MODE === 'true') {
      logger.debug('WhatsApp webhook validation skipped in development mode');
      return true;
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!authToken) {
      logger.warn('⚠️ TWILIO_AUTH_TOKEN not configured');
      return false;
    }

    // Twilio signature validation
    const concatenatedUrl = url + Object.keys(params).sort().map(key => key + params[key]).join('');
    const hash = crypto
      .createHmac('sha1', authToken)
      .update(concatenatedUrl)
      .digest('base64');

    const isValid = hash === signature;
    
    if (!isValid) {
      auditLogger.logSecurity('WHATSAPP_WEBHOOK_SIGNATURE_MISMATCH', 'webhook', 'unknown', {
        url: url,
        expectedSignature: hash.substring(0, 20) + '...',
        providedSignature: signature
      });
    }

    return isValid;
  } catch (error) {
    logger.error('WhatsApp webhook signature validation error:', error);
    return false;
  }
}

/**
 * Facebook Messenger Webhook Signature Validation
 */
function validateFacebookSignature(body, signature) {
  try {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    
    if (!appSecret) {
      logger.warn('⚠️ FACEBOOK_APP_SECRET not configured');
      return false;
    }

    if (!signature) {
      logger.warn('⚠️ No signature provided for Facebook webhook');
      return false;
    }

    // Facebook uses HMAC-SHA256 with 'sha256=' prefix
    const providedSignature = signature.replace('sha256=', '');
    
    const hash = crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex');

    const isValid = hash === providedSignature;
    
    if (!isValid) {
      auditLogger.logSecurity('FACEBOOK_WEBHOOK_SIGNATURE_MISMATCH', 'webhook', 'unknown', {
        expectedSignature: hash.substring(0, 20) + '...',
        providedSignature: providedSignature.substring(0, 20) + '...'
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Facebook webhook signature validation error:', error);
    return false;
  }
}

/**
 * WeChat Webhook Signature Validation
 */
function validateWeChatSignature(token, timestamp, nonce, signature) {
  try {
    if (!token) {
      logger.warn('⚠️ WECHAT_TOKEN not configured');
      return false;
    }

    // Sort and concatenate
    const tmpStr = [token, timestamp, nonce].sort().join('');
    
    // SHA1 hash
    const hash = crypto.createHash('sha1').update(tmpStr).digest('hex');

    const isValid = hash === signature;
    
    if (!isValid) {
      auditLogger.logSecurity('WECHAT_WEBHOOK_SIGNATURE_MISMATCH', 'webhook', 'unknown', {
        expectedSignature: hash,
        providedSignature: signature
      });
    }

    return isValid;
  } catch (error) {
    logger.error('WeChat webhook signature validation error:', error);
    return false;
  }
}

/**
 * Instagram Webhook Signature Validation
 */
function validateInstagramSignature(body, signature) {
  try {
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    
    if (!appSecret) {
      logger.warn('⚠️ INSTAGRAM_APP_SECRET not configured');
      return false;
    }

    // Instagram uses HMAC-SHA256
    const hash = crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex');

    const expectedSignature = 'sha256=' + hash;
    const isValid = expectedSignature === signature;
    
    if (!isValid) {
      auditLogger.logSecurity('INSTAGRAM_WEBHOOK_SIGNATURE_MISMATCH', 'webhook', 'unknown', {
        expectedSignature: expectedSignature.substring(0, 30) + '...',
        providedSignature: signature
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Instagram webhook signature validation error:', error);
    return false;
  }
}

/**
 * Generic webhook signature validator
 */
function validateWebhook(platform, req) {
  try {
    // Handle different request object formats
    const signature = req.headers?.[`x-${platform}-signature`] || 
                     req.headers?.[`x-hub-signature-256`] ||
                     req.headers?.['x-twilio-signature'] ||
                     req.body?.signature;

    const body = req.bodyText || JSON.stringify(req.body || {});
    const headers = req.headers || {};

    switch (platform.toLowerCase()) {
      case 'line':
        return validateLineSignature(body, signature);
      
      case 'whatsapp':
        // For Twilio WhatsApp, signature validation is complex
        // In development/sandbox mode, allow without signature
        const skipValidation = process.env.TWILIO_SANDBOX_MODE === 'true' || 
                               process.env.SKIP_WEBHOOK_SIGNATURE === 'true';
        if (skipValidation) {
          logger.debug('WhatsApp webhook validation skipped (sandbox mode)');
          return true;
        }
        
        // Try to validate if signature exists
        if (signature) {
          return validateWhatsAppSignature(req.url || '', req.body || {}, signature);
        }
        // If no signature in production, fail validation
        if (process.env.NODE_ENV === 'production') {
          logger.warn('WhatsApp webhook validation failed: No signature in production mode');
          return false;
        }
        // Allow in development if no signature
        return true;
      
      case 'facebook':
        return validateFacebookSignature(body, signature);
      
      case 'wechat':
        const { signature: sig, timestamp, nonce } = req.query || {};
        return validateWeChatSignature(process.env.WECHAT_TOKEN, timestamp, nonce, sig);
      
      case 'instagram':
        return validateInstagramSignature(body, signature);
      
      default:
        logger.warn(`Unknown platform for webhook validation: ${platform}`);
        // In production, fail unknown platforms
        return process.env.NODE_ENV !== 'production';
    }
  } catch (error) {
    logger.error('Webhook validation error:', error);
    auditLogger.logSecurity('WEBHOOK_VALIDATION_ERROR', 'webhook', req.ip || 'unknown', {
      platform: platform,
      error: error.message
    });
    // In production, fail on errors
    return process.env.NODE_ENV !== 'production';
  }
}

module.exports = {
  validateWebhook,
  validateLineSignature,
  validateWhatsAppSignature,
  validateFacebookSignature,
  validateWeChatSignature,
  validateInstagramSignature
};
