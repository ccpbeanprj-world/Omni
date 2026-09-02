/**
 * Centralized Error Handling Utility
 * Provides consistent error responses across the application
 */

class ErrorHandler {
  /**
   * Handle API errors with structured responses
   */
  static handleApiError(error, req, res, next) {
    const timestamp = new Date().toISOString();
    const requestId = req.requestId || 'unknown';
    
    // Log error details
    console.error('❌ API Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      requestId: requestId,
      timestamp: timestamp,
      body: req.body,
      params: req.params,
      query: req.query
    });
    
    // Determine error status code
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      errorMessage = 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      errorMessage = 'Forbidden';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      errorMessage = 'Resource not found';
    } else if (error.name === 'ConflictError') {
      statusCode = 409;
      errorMessage = 'Resource conflict';
    } else if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    }
    
    // Send structured error response
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      requestId: requestId,
      timestamp: timestamp,
      path: req.url,
      method: req.method,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error.details
      })
    });
  }
  
  /**
   * Handle webhook errors with structured responses
   */
  static handleWebhookError(error, platform, req, res) {
    const timestamp = new Date().toISOString();
    const requestId = req.requestId || 'unknown';
    
    console.error(`❌ ${platform.toUpperCase()} Webhook Error:`, {
      message: error.message,
      stack: error.stack,
      platform: platform,
      requestId: requestId,
      timestamp: timestamp,
      headers: req.headers,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      platform: platform,
      requestId: requestId,
      timestamp: timestamp
    });
  }
  
  /**
   * Handle Socket.IO errors
   */
  static handleSocketError(error, socket, event) {
    const timestamp = new Date().toISOString();
    
    console.error('❌ Socket.IO Error:', {
      message: error.message,
      stack: error.stack,
      event: event,
      socketId: socket.id,
      timestamp: timestamp
    });
    
    // Emit error to client
    socket.emit('error', {
      success: false,
      error: 'Socket operation failed',
      event: event,
      timestamp: timestamp
    });
  }
  
  /**
   * Handle database errors
   */
  static handleDatabaseError(error, operation, context = {}) {
    const timestamp = new Date().toISOString();
    
    console.error('❌ Database Error:', {
      message: error.message,
      stack: error.stack,
      operation: operation,
      context: context,
      timestamp: timestamp
    });
    
    // Return structured error
    return {
      success: false,
      error: 'Database operation failed',
      operation: operation,
      timestamp: timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message
      })
    };
  }
  
  /**
   * Handle LINE API errors
   */
  static handleLineApiError(error, operation, userId = null) {
    const timestamp = new Date().toISOString();
    
    console.error('❌ LINE API Error:', {
      message: error.message,
      stack: error.stack,
      operation: operation,
      userId: userId,
      timestamp: timestamp,
      response: error.response?.data
    });
    
    return {
      success: false,
      error: 'LINE API operation failed',
      operation: operation,
      userId: userId,
      timestamp: timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.response?.data || error.message
      })
    };
  }
  
  /**
   * Create custom error with status code
   */
  static createError(message, statusCode = 500, name = 'CustomError') {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.name = name;
    return error;
  }
  
  /**
   * Validation error creator
   */
  static validationError(message, field = null) {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.statusCode = 400;
    error.field = field;
    return error;
  }
  
  /**
   * Not found error creator
   */
  static notFoundError(resource, id = null) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    const error = new Error(message);
    error.name = 'NotFoundError';
    error.statusCode = 404;
    error.resource = resource;
    error.id = id;
    return error;
  }
}

module.exports = ErrorHandler;


