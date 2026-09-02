/**
 * Structured Logging Service with Winston
 * Provides consistent, structured logging across the application
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config/appConfig');
const { redactDeep } = require('../config/secrets');

class LoggerService {
  constructor() {
    this.logger = null;
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the logger
   */
  initialize() {
    const loggingConfig = config.getLoggingConfig();
    
    // Create logs directory if it doesn't exist
    if (loggingConfig.file.enabled) {
      const fs = require('fs');
      if (!fs.existsSync(loggingConfig.file.path)) {
        fs.mkdirSync(loggingConfig.file.path, { recursive: true });
      }
    }

    const sanitizeFormat = winston.format((info) => {
      const redacted = redactDeep({ ...info });
      Object.assign(info, redacted);
      return info;
    });

    // Define log format
    const logFormat = winston.format.combine(
      sanitizeFormat(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const logEntry = redactDeep({
          timestamp,
          level,
          message,
          ...meta
        });
        return JSON.stringify(logEntry);
      })
    );

    // Define console format for development
    const consoleFormat = winston.format.combine(
      sanitizeFormat(),
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss.SSS'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const safeMeta = redactDeep(meta);
        const metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    );

    // Create transports array
    const transports = [];

    // Console transport
    if (loggingConfig.console.enabled) {
      transports.push(
        new winston.transports.Console({
          level: loggingConfig.level,
          format: consoleFormat
        })
      );
    }

    // File transports
    if (loggingConfig.file.enabled) {
      // Error log file
      transports.push(
        new DailyRotateFile({
          filename: path.join(loggingConfig.file.path, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          format: logFormat,
          maxSize: loggingConfig.file.maxSize,
          maxFiles: loggingConfig.file.maxFiles,
          zippedArchive: true
        })
      );

      // Combined log file
      transports.push(
        new DailyRotateFile({
          filename: path.join(loggingConfig.file.path, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: loggingConfig.level,
          format: logFormat,
          maxSize: loggingConfig.file.maxSize,
          maxFiles: loggingConfig.file.maxFiles,
          zippedArchive: true
        })
      );

      // Application log file
      transports.push(
        new DailyRotateFile({
          filename: path.join(loggingConfig.file.path, 'app-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'info',
          format: logFormat,
          maxSize: loggingConfig.file.maxSize,
          maxFiles: loggingConfig.file.maxFiles,
          zippedArchive: true
        })
      );
    }

    // Create logger
    this.logger = winston.createLogger({
      level: loggingConfig.level,
      format: logFormat,
      transports,
      exitOnError: false
    });

    this.isInitialized = true;
    console.log(`✅ Logger initialized with level: ${loggingConfig.level}`);
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    if (this.logger) {
      this.logger.info(message, {
        service: 'omni-platform',
        environment: config.getEnvironment(),
        ...meta
      });
    }
  }

  /**
   * Log error message
   */
  error(message, error = null, meta = {}) {
    if (this.logger) {
      const errorMeta = {
        service: 'omni-platform',
        environment: config.getEnvironment(),
        ...meta
      };

      if (error) {
        errorMeta.error = {
          message: error.message,
          stack: error.stack,
          name: error.name
        };
      }

      this.logger.error(message, errorMeta);
    }
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    if (this.logger) {
      this.logger.warn(message, {
        service: 'omni-platform',
        environment: config.getEnvironment(),
        ...meta
      });
    }
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    if (this.logger) {
      this.logger.debug(message, {
        service: 'omni-platform',
        environment: config.getEnvironment(),
        ...meta
      });
    }
  }

  /**
   * Log HTTP request
   */
  httpRequest(req, res, responseTime) {
    if (this.logger) {
      this.logger.info('HTTP Request', {
        service: 'omni-platform',
        type: 'http_request',
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId: req.requestId
      });
    }
  }

  /**
   * Log Socket.IO events
   */
  socketEvent(event, socketId, data = {}) {
    if (this.logger) {
      this.logger.info('Socket.IO Event', {
        service: 'omni-platform',
        type: 'socket_event',
        event,
        socketId,
        data: typeof data === 'object' ? data : { message: data }
      });
    }
  }

  /**
   * Log database operations
   */
  databaseOperation(operation, table, duration, meta = {}) {
    if (this.logger) {
      this.logger.info('Database Operation', {
        service: 'omni-platform',
        type: 'database_operation',
        operation,
        table,
        duration: `${duration}ms`,
        ...meta
      });
    }
  }

  /**
   * Log API calls to external services
   */
  externalApiCall(service, endpoint, method, statusCode, duration, meta = {}) {
    if (this.logger) {
      this.logger.info('External API Call', {
        service: 'omni-platform',
        type: 'external_api_call',
        externalService: service,
        endpoint,
        method,
        statusCode,
        duration: `${duration}ms`,
        ...meta
      });
    }
  }

  /**
   * Log user actions
   */
  userAction(userId, action, platform, meta = {}) {
    if (this.logger) {
      this.logger.info('User Action', {
        service: 'omni-platform',
        type: 'user_action',
        userId,
        action,
        platform,
        ...meta
      });
    }
  }

  /**
   * Log system events
   */
  systemEvent(event, meta = {}) {
    if (this.logger) {
      this.logger.info('System Event', {
        service: 'omni-platform',
        type: 'system_event',
        event,
        ...meta
      });
    }
  }

  /**
   * Log performance metrics
   */
  performance(metric, value, unit = 'ms', meta = {}) {
    if (this.logger) {
      this.logger.info('Performance Metric', {
        service: 'omni-platform',
        type: 'performance',
        metric,
        value,
        unit,
        ...meta
      });
    }
  }

  /**
   * Log security events
   */
  security(event, severity = 'info', meta = {}) {
    if (this.logger) {
      this.logger[severity]('Security Event', {
        service: 'omni-platform',
        type: 'security',
        event,
        severity,
        ...meta
      });
    }
  }

  /**
   * Get logger statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      level: this.logger?.level || 'unknown',
      transports: this.logger?.transports?.length || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create child logger with additional context
   */
  child(defaultMeta = {}) {
    if (this.logger) {
      return this.logger.child({
        service: 'omni-platform',
        environment: config.getEnvironment(),
        ...defaultMeta
      });
    }
    return null;
  }
}

// Export singleton instance
const logger = new LoggerService();
module.exports = logger;