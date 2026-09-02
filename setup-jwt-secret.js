#!/usr/bin/env node

/**
 * Generate a secure JWT secret key
 * Run this script to generate a random 64-character hex key
 */

const crypto = require('crypto');

function generateJWTSecret() {
  // Generate a 32-byte (256-bit) random key
  const secret = crypto.randomBytes(32).toString('hex');
  
  console.log('');
  console.log('🔐 Generated JWT Secret:');
  console.log('='.repeat(70));
  console.log(secret);
  console.log('='.repeat(70));
  console.log('');
  console.log('📝 Add this to your .env file:');
  console.log('');
  console.log('JWT_SECRET=' + secret);
  console.log('');
  
  return secret;
}

// Generate if run directly
if (require.main === module) {
  generateJWTSecret();
}

module.exports = { generateJWTSecret };

