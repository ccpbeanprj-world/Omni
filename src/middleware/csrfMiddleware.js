/**
 * CSRF Protection Middleware
 * Provides CSRF token generation and validation
 */

const csrf = require('csrf');
const tokens = new csrf();

// In-memory CSRF secret storage (for stateless API)
const csrfSecrets = new Map();

/**
 * Generate CSRF token
 */
function generateCSRFToken(req, res, next) {
  // Skip CSRF for webhooks and public endpoints
  if (req.path.startsWith('/webhook/') || req.path === '/api/health') {
    return next();
  }

  // Generate or retrieve secret (use IP + User-Agent as identifier for stateless API)
  const identifier = req.ip || 'anonymous';
  const secret = csrfSecrets.get(identifier) || tokens.secretSync();
  
  if (!csrfSecrets.has(identifier)) {
    csrfSecrets.set(identifier, secret);
  }

  req.csrfToken = () => tokens.create(secret);
  next();
}

/**
 * Validate CSRF token
 */
function validateCSRFToken(req, res, next) {
  // Skip CSRF for webhooks, public endpoints, and GET requests
  if (req.path.startsWith('/webhook/') || 
      req.path === '/api/health' || 
      req.method === 'GET' ||
      req.method === 'OPTIONS') {
    return next();
  }

  const identifier = req.ip || 'anonymous';
  const secret = csrfSecrets.get(identifier);
  const token = req.headers['x-csrf-token'] || req.body.csrfToken;

  if (!secret) {
    return res.status(403).json({ 
      success: false, 
      error: 'CSRF secret not found',
      requiresCSRF: true
    });
  }

  if (!token) {
    return res.status(403).json({ 
      success: false, 
      error: 'CSRF token missing',
      requiresCSRF: true
    });
  }

  if (!tokens.verify(secret, token)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid CSRF token',
      requiresCSRF: true
    });
  }

  next();
}

/**
 * Get CSRF token for frontend
 */
function getCSRFToken(req, res) {
  const identifier = req.ip || 'anonymous';
  const secret = csrfSecrets.get(identifier) || tokens.secretSync();
  
  if (!csrfSecrets.has(identifier)) {
    csrfSecrets.set(identifier, secret);
  }
  
  const token = tokens.create(secret);
  return res.json({ 
    success: true, 
    csrfToken: token 
  });
}

module.exports = {
  generateCSRFToken,
  validateCSRFToken,
  getCSRFToken
};

