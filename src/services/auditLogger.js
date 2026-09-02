#!/usr/bin/env node

/**
 * Audit Logging System
 * Comprehensive audit trails for security and compliance
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor() {
    this.auditDir = path.join(__dirname, '../logs/audit');
    this.ensureAuditDirectory();
    this.setupLogRotation();
  }

  /**
   * Ensure audit directory exists
   */
  ensureAuditDirectory() {
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
  }

  /**
   * Setup log rotation
   */
  setupLogRotation() {
    // Rotate logs daily
    setInterval(() => {
      this.rotateLogs();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Rotate audit logs
   */
  rotateLogs() {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.auditDir, `audit-${today}.log`);
    
    // Archive old logs (keep 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    fs.readdirSync(this.auditDir).forEach(file => {
      if (file.startsWith('audit-') && file.endsWith('.log')) {
        const fileDate = new Date(file.replace('audit-', '').replace('.log', ''));
        if (fileDate < thirtyDaysAgo) {
          fs.unlinkSync(path.join(this.auditDir, file));
        }
      }
    });
  }

  /**
   * Generate audit ID
   */
  generateAuditId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Log authentication events
   */
  logAuthentication(action, userId, ip, userAgent, success, details = {}) {
    const auditEntry = {
      auditId: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: 'AUTHENTICATION',
      action: action, // LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_CHANGE, etc.
      userId: userId,
      ip: ip,
      userAgent: userAgent,
      success: success,
      details: details,
      riskLevel: this.calculateRiskLevel('AUTHENTICATION', action, success)
    };
    
    this.writeAuditLog(auditEntry);
    return auditEntry.auditId;
  }

  /**
   * Log message events
   */
  logMessage(action, userId, conversationId, platform, messageId, details = {}) {
    const auditEntry = {
      auditId: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: 'MESSAGE',
      action: action, // SEND, RECEIVE, DELETE, EDIT, etc.
      userId: userId,
      conversationId: conversationId,
      platform: platform,
      messageId: messageId,
      details: details,
      riskLevel: this.calculateRiskLevel('MESSAGE', action, true)
    };
    
    this.writeAuditLog(auditEntry);
    return auditEntry.auditId;
  }

  /**
   * Log system events
   */
  logSystem(action, userId, details = {}) {
    const auditEntry = {
      auditId: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: 'SYSTEM',
      action: action, // STARTUP, SHUTDOWN, CONFIG_CHANGE, ERROR, etc.
      userId: userId,
      details: details,
      riskLevel: this.calculateRiskLevel('SYSTEM', action, true)
    };
    
    this.writeAuditLog(auditEntry);
    return auditEntry.auditId;
  }

  /**
   * Log security events
   */
  logSecurity(action, userId, ip, details = {}) {
    const auditEntry = {
      auditId: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: 'SECURITY',
      action: action, // SUSPICIOUS_ACTIVITY, RATE_LIMIT_EXCEEDED, XSS_ATTEMPT, etc.
      userId: userId,
      ip: ip,
      details: details,
      riskLevel: this.calculateRiskLevel('SECURITY', action, false)
    };
    
    this.writeAuditLog(auditEntry);
    return auditEntry.auditId;
  }

  /**
   * Log data access events
   */
  logDataAccess(action, userId, resourceType, resourceId, details = {}) {
    const auditEntry = {
      auditId: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: 'DATA_ACCESS',
      action: action, // READ, WRITE, DELETE, EXPORT, etc.
      userId: userId,
      resourceType: resourceType,
      resourceId: resourceId,
      details: details,
      riskLevel: this.calculateRiskLevel('DATA_ACCESS', action, true)
    };
    
    this.writeAuditLog(auditEntry);
    return auditEntry.auditId;
  }

  /**
   * Calculate risk level
   */
  calculateRiskLevel(category, action, success) {
    const riskMatrix = {
      'AUTHENTICATION': {
        'LOGIN': success ? 'LOW' : 'MEDIUM',
        'LOGIN_FAILED': 'MEDIUM',
        'PASSWORD_CHANGE': 'MEDIUM',
        'LOGOUT': 'LOW'
      },
      'MESSAGE': {
        'SEND': 'LOW',
        'RECEIVE': 'LOW',
        'DELETE': 'MEDIUM',
        'EDIT': 'MEDIUM'
      },
      'SYSTEM': {
        'STARTUP': 'LOW',
        'SHUTDOWN': 'LOW',
        'CONFIG_CHANGE': 'HIGH',
        'ERROR': 'MEDIUM'
      },
      'SECURITY': {
        'SUSPICIOUS_ACTIVITY': 'HIGH',
        'RATE_LIMIT_EXCEEDED': 'MEDIUM',
        'XSS_ATTEMPT': 'HIGH',
        'SQL_INJECTION_ATTEMPT': 'HIGH'
      },
      'DATA_ACCESS': {
        'READ': 'LOW',
        'WRITE': 'MEDIUM',
        'DELETE': 'HIGH',
        'EXPORT': 'HIGH'
      }
    };
    
    return riskMatrix[category]?.[action] || 'MEDIUM';
  }

  /**
   * Write audit log entry
   */
  writeAuditLog(auditEntry) {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.auditDir, `audit-${today}.log`);
    
    const logLine = JSON.stringify(auditEntry) + '\n';
    
    try {
      fs.appendFileSync(logFile, logLine);
      
      // Also log high-risk events to console for immediate attention
      if (auditEntry.riskLevel === 'HIGH') {
        console.error(`🚨 HIGH RISK AUDIT EVENT: ${auditEntry.category}:${auditEntry.action} - ${auditEntry.auditId}`);
      }
    } catch (error) {
      console.error('❌ Failed to write audit log:', error);
    }
  }

  /**
   * Query audit logs
   */
  queryAuditLogs(filters = {}) {
    const results = [];
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.auditDir, `audit-${today}.log`);
    
    if (!fs.existsSync(logFile)) {
      return results;
    }
    
    try {
      const logContent = fs.readFileSync(logFile, 'utf8');
      const lines = logContent.trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          const entry = JSON.parse(line);
          
          // Apply filters
          let matches = true;
          
          if (filters.category && entry.category !== filters.category) {
            matches = false;
          }
          
          if (filters.action && entry.action !== filters.action) {
            matches = false;
          }
          
          if (filters.userId && entry.userId !== filters.userId) {
            matches = false;
          }
          
          if (filters.riskLevel && entry.riskLevel !== filters.riskLevel) {
            matches = false;
          }
          
          if (filters.startDate && new Date(entry.timestamp) < new Date(filters.startDate)) {
            matches = false;
          }
          
          if (filters.endDate && new Date(entry.timestamp) > new Date(filters.endDate)) {
            matches = false;
          }
          
          if (matches) {
            results.push(entry);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to query audit logs:', error);
    }
    
    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get audit statistics
   */
  getAuditStatistics(days = 7) {
    const stats = {
      totalEvents: 0,
      byCategory: {},
      byRiskLevel: {},
      byAction: {},
      suspiciousActivity: 0,
      failedLogins: 0
    };
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const logFile = path.join(this.auditDir, `audit-${dateStr}.log`);
      
      if (fs.existsSync(logFile)) {
        try {
          const logContent = fs.readFileSync(logFile, 'utf8');
          const lines = logContent.trim().split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              const entry = JSON.parse(line);
              stats.totalEvents++;
              
              // Count by category
              stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
              
              // Count by risk level
              stats.byRiskLevel[entry.riskLevel] = (stats.byRiskLevel[entry.riskLevel] || 0) + 1;
              
              // Count by action
              stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
              
              // Count suspicious activity
              if (entry.category === 'SECURITY' && entry.action === 'SUSPICIOUS_ACTIVITY') {
                stats.suspiciousActivity++;
              }
              
              // Count failed logins
              if (entry.category === 'AUTHENTICATION' && entry.action === 'LOGIN_FAILED') {
                stats.failedLogins++;
              }
            }
          }
        } catch (error) {
          console.error(`❌ Failed to read audit log for ${dateStr}:`, error);
        }
      }
    }
    
    return stats;
  }
}

module.exports = AuditLogger;
