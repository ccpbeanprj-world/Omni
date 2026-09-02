const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Register new agent
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name, role = 'agent' } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM agents WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await query(
      `INSERT INTO agents (username, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, username, email, name, role, status, created_at`,
      [username, email, passwordHash, name, role]
    );

    logger.info('New agent registered', {
      userId: newUser.rows[0].id,
      username: newUser.rows[0].username
    });

    res.status(201).json({
      success: true,
      data: newUser.rows[0]
    });
  } catch (error) {
    logger.error('Failed to register agent', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register agent'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find user
    const user = await query(
      'SELECT * FROM agents WHERE username = $1 OR email = $1',
      [username]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const agent = user.rows[0];

    // Check if account is active
    if (agent.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'Account is not active'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, agent.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: agent.id,
        username: agent.username,
        email: agent.email,
        role: agent.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Update last login
    await query(
      'UPDATE agents SET updated_at = NOW() WHERE id = $1',
      [agent.id]
    );

    logger.info('Agent logged in', {
      userId: agent.id,
      username: agent.username
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: agent.id,
          username: agent.username,
          email: agent.email,
          name: agent.name,
          role: agent.role,
          status: agent.status
        }
      }
    });
  } catch (error) {
    logger.error('Failed to login', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Token verification failed', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await query(
      'SELECT id, username, email, name, role, status, created_at FROM agents WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    logger.error('Failed to get profile', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Update profile
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      values.push(name);
    }

    if (email) {
      paramCount++;
      updateFields.push(`email = $${paramCount}`);
      values.push(email);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    paramCount++;
    updateFields.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const user = await query(
      `UPDATE agents 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, username, email, name, role, status, updated_at`,
      values
    );

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update profile', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Change password
router.patch('/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Get current user
    const user = await query(
      'SELECT password_hash FROM agents WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.rows[0].password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await query(
      'UPDATE agents SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    logger.info('Password changed', {
      userId: req.user.id,
      username: req.user.username
    });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('Failed to change password', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', verifyToken, (req, res) => {
  logger.info('Agent logged out', {
    userId: req.user.id,
    username: req.user.username
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;

