#!/usr/bin/env node

/**
 * Data Encryption Service
 * Encrypt sensitive data at rest
 */

const crypto = require('crypto');

class DataEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    
    // Get encryption key from environment or generate one
    this.encryptionKey = this.getOrGenerateKey();
  }

  /**
   * Get or generate encryption key
   */
  getOrGenerateKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    
    if (envKey) {
      // Use provided key (should be 64 hex characters for 256-bit key)
      if (envKey.length === 64) {
        return Buffer.from(envKey, 'hex');
      } else {
        console.warn('⚠️ ENCRYPTION_KEY length invalid, generating new key');
      }
    }
    
    // Generate an ephemeral key. Do not print it — set ENCRYPTION_KEY in .env for production.
    const newKey = crypto.randomBytes(this.keyLength);
    console.warn('⚠️ No ENCRYPTION_KEY found, using an ephemeral in-memory key. Set ENCRYPTION_KEY in .env for production (never commit it).');
    
    return newKey;
  }

  /**
   * Encrypt data
   */
  encrypt(data) {
    try {
      if (!data) {
        return null;
      }
      
      // Convert to string if not already
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('omni-platform', 'utf8'));
      
      // Encrypt data
      let encrypted = cipher.update(dataString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
      
      return combined;
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData) {
        return null;
      }
      
      // Split combined data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('omni-platform', 'utf8'));
      decipher.setAuthTag(tag);
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Encrypt sensitive fields in an object
   */
  encryptSensitiveFields(obj, fieldsToEncrypt) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const encrypted = { ...obj };
    
    for (const field of fieldsToEncrypt) {
      if (encrypted[field] !== undefined && encrypted[field] !== null) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt sensitive fields in an object
   */
  decryptSensitiveFields(obj, fieldsToDecrypt) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const decrypted = { ...obj };
    
    for (const field of fieldsToDecrypt) {
      if (decrypted[field] !== undefined && decrypted[field] !== null) {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          console.warn(`⚠️ Failed to decrypt field ${field}:`, error.message);
          // Keep original value if decryption fails
        }
      }
    }
    
    return decrypted;
  }

  /**
   * Hash password (one-way encryption)
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password
   */
  verifyPassword(password, hashedPassword) {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      return hash === verifyHash;
    } catch (error) {
      console.error('❌ Password verification failed:', error);
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key
   */
  generateApiKey() {
    const prefix = 'omni_';
    const randomPart = crypto.randomBytes(24).toString('hex');
    return prefix + randomPart;
  }

  /**
   * Hash sensitive data for search (one-way)
   */
  hashForSearch(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypt database connection string
   */
  encryptDatabaseConnection(connectionString) {
    return this.encrypt(connectionString);
  }

  /**
   * Decrypt database connection string
   */
  decryptDatabaseConnection(encryptedConnectionString) {
    return this.decrypt(encryptedConnectionString);
  }

  /**
   * Encrypt API keys and tokens
   */
  encryptApiCredentials(credentials) {
    const fieldsToEncrypt = [
      'access_token',
      'refresh_token',
      'api_key',
      'secret_key',
      'webhook_secret',
      'private_key'
    ];
    
    return this.encryptSensitiveFields(credentials, fieldsToEncrypt);
  }

  /**
   * Decrypt API keys and tokens
   */
  decryptApiCredentials(encryptedCredentials) {
    const fieldsToDecrypt = [
      'access_token',
      'refresh_token',
      'api_key',
      'secret_key',
      'webhook_secret',
      'private_key'
    ];
    
    return this.decryptSensitiveFields(encryptedCredentials, fieldsToDecrypt);
  }

  /**
   * Encrypt user personal data
   */
  encryptUserData(userData) {
    const fieldsToEncrypt = [
      'email',
      'phone',
      'address',
      'personal_info',
      'profile_data'
    ];
    
    return this.encryptSensitiveFields(userData, fieldsToEncrypt);
  }

  /**
   * Decrypt user personal data
   */
  decryptUserData(encryptedUserData) {
    const fieldsToDecrypt = [
      'email',
      'phone',
      'address',
      'personal_info',
      'profile_data'
    ];
    
    return this.decryptSensitiveFields(encryptedUserData, fieldsToDecrypt);
  }
}

module.exports = DataEncryption;
