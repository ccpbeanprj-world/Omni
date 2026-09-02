const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Socket.IO Authentication Middleware
 * Validates JWT tokens for Socket.IO connections
 * Optionally allows unauthenticated connections in development mode
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!token) {
      if (isDevelopment) {
        // Allow connection in development mode without authentication
        socket.userId = 'anonymous';
        socket.username = 'Anonymous User';
        socket.userRole = 'user';
        socket.isAuthenticated = false;
        
        logger.info('Socket.IO connection allowed without authentication (development mode)', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        
        return next();
      } else {
        logger.warn('Socket.IO connection rejected: No token provided', {
          socketId: socket.id,
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent']
        });
        return next(new Error('Authentication token required'));
      }
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'default_secret_change_in_production';
    const decoded = jwt.verify(token, jwtSecret);
    
    // Attach user info to socket
    socket.userId = decoded.id;
    socket.username = decoded.username || decoded.email || 'User';
    socket.userRole = decoded.role || 'user';
    socket.isAuthenticated = true;
    socket.userPlatform = decoded.platform;
    
    logger.info('Socket.IO connection authenticated', {
      socketId: socket.id,
      userId: decoded.id,
      username: socket.username,
      role: socket.userRole,
      ip: socket.handshake.address
    });
    
    next();
  } catch (error) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development, allow connection even if token verification fails
      socket.userId = 'anonymous';
      socket.username = 'Anonymous User';
      socket.userRole = 'user';
      socket.isAuthenticated = false;
      
      logger.warn('Socket.IO token validation failed, allowing connection (development mode)', {
        socketId: socket.id,
        error: error.message,
        ip: socket.handshake.address
      });
      
      return next();
    } else {
      logger.warn('Socket.IO authentication failed', {
        socketId: socket.id,
        error: error.message,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });
      next(new Error('Invalid authentication token'));
    }
  }
};

/**
 * Socket.IO Authorization Middleware
 * Checks if user has permission to join specific rooms
 */
const socketAuthorizationMiddleware = (socket, next) => {
  // Check if user can access conversation
  const conversationId = socket.handshake.query.conversationId;
  
  if (!conversationId) {
    return next(new Error('Conversation ID required'));
  }

  // For now, allow all authenticated users to join any conversation
  // In production, implement proper conversation access control
  logger.info('Socket.IO room authorization granted', {
    socketId: socket.id,
    userId: socket.userId,
    conversationId: conversationId
  });
  
  next();
};

/**
 * Socket.IO Message Validation
 * Validates message content before processing
 */
const validateSocketMessage = (message) => {
  const errors = [];
  
  // Check message structure
  if (!message || typeof message !== 'object') {
    errors.push('Message must be an object');
    return { isValid: false, errors };
  }
  
  // Validate required fields
  if (!message.content || typeof message.content !== 'string') {
    errors.push('Message content is required and must be a string');
  }
  
  if (!message.conversationId || typeof message.conversationId !== 'string') {
    errors.push('Conversation ID is required and must be a string');
  }
  
  // Validate content length
  if (message.content && message.content.length > 10000) {
    errors.push('Message content too long (max 10000 characters)');
  }
  
  // Validate content for malicious patterns
  if (message.content) {
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi
    ];
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(message.content)) {
        errors.push('Message content contains potentially malicious code');
        break;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Socket.IO Event Handlers with Security
 */
const setupSecureSocketHandlers = (io) => {
  io.use(socketAuthMiddleware);
  
  io.on('connection', (socket) => {
    logger.info('Secure Socket.IO connection established', {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username,
      role: socket.userRole
    });
    
    // Join conversation room
    socket.on('join_conversation', (data) => {
      try {
        const { conversationId } = data;
        
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID required' });
          return;
        }
        
        // Validate conversation access (implement your business logic here)
        socket.join(`conversation_${conversationId}`);
        
        logger.info('User joined conversation room', {
          socketId: socket.id,
          userId: socket.userId,
          conversationId: conversationId
        });
        
        socket.emit('joined_conversation', { conversationId });
      } catch (error) {
        logger.error('Error joining conversation', {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message
        });
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });
    
    // Handle message sending with validation
    socket.on('send_message', (messageData) => {
      try {
        const validation = validateSocketMessage(messageData);
        
        if (!validation.isValid) {
          socket.emit('message_error', {
            message: 'Invalid message format',
            errors: validation.errors
          });
          return;
        }
        
        // Log message attempt
        logger.info('Message sent via Socket.IO', {
          socketId: socket.id,
          userId: socket.userId,
          conversationId: messageData.conversationId,
          messageLength: messageData.content.length
        });
        
        // Broadcast to conversation room
        socket.to(`conversation_${messageData.conversationId}`).emit('new_message', {
          ...messageData,
          senderId: socket.userId,
          senderName: socket.username,
          timestamp: new Date().toISOString()
        });
        
        socket.emit('message_sent', { success: true });
      } catch (error) {
        logger.error('Error processing Socket.IO message', {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message
        });
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });
    
    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.username,
          conversationId: conversationId
        });
      }
    });
    
    socket.on('typing_stop', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          username: socket.username,
          conversationId: conversationId
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('Socket.IO connection disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
        reason: reason
      });
    });
  });
};

module.exports = {
  socketAuthMiddleware,
  socketAuthorizationMiddleware,
  validateSocketMessage,
  setupSecureSocketHandlers
};
