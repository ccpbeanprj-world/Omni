const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Input Validation Middleware
 * Comprehensive validation for all API endpoints
 */

// Common validation schemas
const commonSchemas = {
  // User ID validation
  userId: Joi.string()
    .pattern(/^user_[a-z]+_[a-zA-Z0-9]+$/)
    .min(10)
    .max(100)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'string.min': 'User ID must be at least 10 characters',
      'string.max': 'User ID must not exceed 100 characters'
    }),
  
  // Conversation ID validation
  conversationId: Joi.string()
    .pattern(/^conv_[a-z]+_[a-zA-Z0-9]+$/)
    .min(10)
    .max(100)
    .required()
    .messages({
      'string.pattern.base': 'Invalid conversation ID format',
      'string.min': 'Conversation ID must be at least 10 characters',
      'string.max': 'Conversation ID must not exceed 100 characters'
    }),
  
  // Message content validation
  messageContent: Joi.string()
    .min(1)
    .max(10000)
    .pattern(/^[^<>]*$/) // No HTML tags
    .required()
    .messages({
      'string.min': 'Message content cannot be empty',
      'string.max': 'Message content too long (max 10000 characters)',
      'string.pattern.base': 'Message content contains invalid characters'
    }),
  
  // Platform validation
  platform: Joi.string()
    .valid('line', 'whatsapp', 'facebook', 'telegram', 'wechat')
    .required()
    .messages({
      'any.only': 'Invalid platform. Must be one of: line, whatsapp, facebook, telegram, wechat'
    }),
  
  // Message type validation
  messageType: Joi.string()
    .valid('text', 'image', 'video', 'audio', 'file', 'location', 'sticker')
    .default('text')
    .messages({
      'any.only': 'Invalid message type'
    }),
  
  // Pagination validation
  pagination: {
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(50)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    
    offset: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.min': 'Offset cannot be negative'
      }),
    
    order: Joi.string()
      .valid('ASC', 'DESC')
      .default('DESC')
      .messages({
        'any.only': 'Order must be ASC or DESC'
      })
  }
};

// Specific validation schemas
const validationSchemas = {
  // Send message validation
  sendMessage: Joi.object({
    conversationId: commonSchemas.conversationId,
    content: commonSchemas.messageContent,
    messageType: commonSchemas.messageType,
    platform: commonSchemas.platform
  }),
  
  // Get messages validation
  getMessages: Joi.object({
    conversationId: commonSchemas.conversationId,
    limit: commonSchemas.pagination.limit,
    offset: commonSchemas.pagination.offset,
    order: commonSchemas.pagination.order
  }),
  
  // Get conversations validation
  getConversations: Joi.object({
    limit: commonSchemas.pagination.limit,
    offset: commonSchemas.pagination.offset,
    platform: commonSchemas.platform.optional(),
    status: Joi.string()
      .valid('active', 'inactive', 'pending', 'resolved')
      .optional()
      .messages({
        'any.only': 'Invalid status. Must be one of: active, inactive, pending, resolved'
      })
  }),
  
  // User profile validation
  userProfile: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-_\.]+$/)
      .required()
      .messages({
        'string.min': 'Name cannot be empty',
        'string.max': 'Name too long (max 100 characters)',
        'string.pattern.base': 'Name contains invalid characters'
      }),
    
    displayName: Joi.string()
      .min(1)
      .max(100)
      .optional(),
    
    profilePictureUrl: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Invalid profile picture URL'
      }),
    
    status: Joi.string()
      .valid('active', 'inactive', 'pending', 'blocked')
      .default('active')
      .messages({
        'any.only': 'Invalid status'
      })
  }),
  
  // Authentication validation
  login: Joi.object({
    username: Joi.string()
      .min(3)
      .max(50)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .required()
      .messages({
        'string.min': 'Username must be at least 3 characters',
        'string.max': 'Username cannot exceed 50 characters',
        'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password cannot exceed 128 characters'
      })
  }),
  
  // Webhook validation
  webhook: Joi.object({
    destination: Joi.string()
      .required()
      .messages({
        'any.required': 'Webhook destination is required'
      }),
    
    events: Joi.array()
      .items(
        Joi.object({
          type: Joi.string()
            .valid('message', 'follow', 'unfollow', 'postback', 'beacon')
            .required(),
          
          message: Joi.object({
            type: Joi.string()
              .valid('text', 'image', 'video', 'audio', 'file', 'location', 'sticker')
              .required(),
            
            id: Joi.string()
              .required(),
            
            text: Joi.string()
              .optional()
          }).optional(),
          
          source: Joi.object({
            type: Joi.string()
              .valid('user', 'group', 'room')
              .required(),
            
            userId: Joi.string()
              .required()
          }).required()
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one event is required'
      })
  })
};

/**
 * Validation middleware factory
 * Creates validation middleware for specific schemas
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });
      
      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));
        
        logger.warn('Input validation failed', {
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          errors: errorDetails,
          requestId: req.requestId
        });
        
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorDetails
        });
      }
      
      // Replace request property with validated and sanitized data
      req[property] = value;
      
      logger.debug('Input validation successful', {
        url: req.url,
        method: req.method,
        requestId: req.requestId
      });
      
      next();
    } catch (err) {
      logger.error('Validation middleware error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        requestId: req.requestId
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
};

/**
 * Sanitization middleware
 * Sanitizes input data to prevent XSS and injection attacks
 */
const sanitizeInput = (req, res, next) => {
  try {
    const sanitize = (obj) => {
      if (typeof obj === 'string') {
        return obj
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/data:text\/html/gi, '')
          .trim();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitize(value);
        }
        return sanitized;
      }
      
      return obj;
    };
    
    // Sanitize request body
    if (req.body) {
      req.body = sanitize(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitize(req.query);
    }
    
    // Sanitize route parameters
    if (req.params) {
      req.params = sanitize(req.params);
    }
    
    next();
  } catch (err) {
    logger.error('Sanitization middleware error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal sanitization error'
    });
  }
};

/**
 * File upload validation
 * Validates file uploads for security
 */
const validateFileUpload = (req, res, next) => {
  try {
    if (!req.file && !req.files) {
      return next();
    }
    
    const files = req.file ? [req.file] : req.files;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    for (const file of files) {
      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        logger.warn('Invalid file type uploaded', {
          filename: file.originalname,
          mimetype: file.mimetype,
          ip: req.ip,
          requestId: req.requestId
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid file type. Only images are allowed.'
        });
      }
      
      // Check file size
      if (file.size > maxSize) {
        logger.warn('File too large uploaded', {
          filename: file.originalname,
          size: file.size,
          maxSize: maxSize,
          ip: req.ip,
          requestId: req.requestId
        });
        
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 10MB.'
        });
      }
      
      // Check filename for malicious patterns
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        logger.warn('Suspicious filename uploaded', {
          filename: file.originalname,
          ip: req.ip,
          requestId: req.requestId
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid filename.'
        });
      }
    }
    
    logger.info('File upload validated', {
      fileCount: files.length,
      ip: req.ip,
      requestId: req.requestId
    });
    
    next();
  } catch (err) {
    logger.error('File upload validation error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal file validation error'
    });
  }
};

module.exports = {
  validationSchemas,
  commonSchemas,
  validate,
  sanitizeInput,
  validateFileUpload
};


