const logger = require('../utils/logger');

class ContractExtractionService {
  constructor() {
    this.phoneRegex = /(\+?[1-9]\d{1,14})|(\(\d{3}\)\s?\d{3}-\d{4})|(\d{3}-\d{3}-\d{4})|(\d{10})/g;
    this.emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    this.contractKeywords = [
      'contract', 'agreement', 'deal', 'proposal', 'quote', 'estimate',
      'invoice', 'payment', 'price', 'cost', 'amount', 'total',
      'service', 'product', 'delivery', 'shipping', 'warranty',
      'terms', 'conditions', 'signature', 'signed', 'approve'
    ];
  }

  /**
   * Extract contract information from message content
   * @param {string} content - Message content
   * @param {string} platform - Chat platform
   * @param {Object} userInfo - User information
   * @returns {Object} Extracted contract data
   */
  extractContractData(content, platform, userInfo = {}) {
    try {
      const contractData = {
        platform,
        extractedAt: new Date().toISOString(),
        confidence: 0,
        data: {}
      };

      // Extract phone numbers
      const phoneNumbers = this.extractPhoneNumbers(content);
      if (phoneNumbers.length > 0) {
        contractData.data.phoneNumbers = phoneNumbers;
        contractData.confidence += 20;
      }

      // Extract email addresses
      const emails = this.extractEmails(content);
      if (emails.length > 0) {
        contractData.data.emails = emails;
        contractData.confidence += 15;
      }

      // Extract monetary amounts
      const amounts = this.extractMonetaryAmounts(content);
      if (amounts.length > 0) {
        contractData.data.amounts = amounts;
        contractData.confidence += 25;
      }

      // Extract contract-related keywords
      const keywords = this.extractContractKeywords(content);
      if (keywords.length > 0) {
        contractData.data.keywords = keywords;
        contractData.confidence += keywords.length * 5;
      }

      // Extract dates
      const dates = this.extractDates(content);
      if (dates.length > 0) {
        contractData.data.dates = dates;
        contractData.confidence += 10;
      }

      // Add user information
      if (userInfo.phone) {
        contractData.data.userPhone = userInfo.phone;
        contractData.confidence += 10;
      }

      if (userInfo.email) {
        contractData.data.userEmail = userInfo.email;
        contractData.confidence += 10;
      }

      contractData.confidence = Math.min(contractData.confidence, 100);

      logger.info('Contract data extracted', {
        platform,
        confidence: contractData.confidence,
        hasPhone: !!contractData.data.phoneNumbers?.length,
        hasEmail: !!contractData.data.emails?.length,
        hasAmounts: !!contractData.data.amounts?.length
      });

      return contractData;
    } catch (error) {
      logger.error('Failed to extract contract data', {
        platform,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Extract phone numbers from text
   * @param {string} text - Input text
   * @returns {Array} Array of phone numbers
   */
  extractPhoneNumbers(text) {
    const matches = text.match(this.phoneRegex) || [];
    return matches.map(phone => phone.trim()).filter((phone, index, arr) => arr.indexOf(phone) === index);
  }

  /**
   * Extract email addresses from text
   * @param {string} text - Input text
   * @returns {Array} Array of email addresses
   */
  extractEmails(text) {
    const matches = text.match(this.emailRegex) || [];
    return matches.map(email => email.toLowerCase().trim()).filter((email, index, arr) => arr.indexOf(email) === index);
  }

  /**
   * Extract monetary amounts from text
   * @param {string} text - Input text
   * @returns {Array} Array of monetary amounts
   */
  extractMonetaryAmounts(text) {
    const amountRegex = /(\$|€|£|¥|₹|₽|₩|₪|₨|₦|₡|₱|₫|₴|₸|₼|₾|₿|USD|EUR|GBP|JPY|INR|RUB|KRW|ILS|PKR|NGN|CRC|PHP|VND|UAH|KZT|AZN|AMD)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi;
    const matches = text.match(amountRegex) || [];
    return matches.map(amount => amount.trim()).filter((amount, index, arr) => arr.indexOf(amount) === index);
  }

  /**
   * Extract contract-related keywords from text
   * @param {string} text - Input text
   * @returns {Array} Array of keywords found
   */
  extractContractKeywords(text) {
    const lowerText = text.toLowerCase();
    return this.contractKeywords.filter(keyword => lowerText.includes(keyword));
  }

  /**
   * Extract dates from text
   * @param {string} text - Input text
   * @returns {Array} Array of dates
   */
  extractDates(text) {
    const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})|(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi;
    const matches = text.match(dateRegex) || [];
    return matches.map(date => date.trim()).filter((date, index, arr) => arr.indexOf(date) === index);
  }

  /**
   * Get user phone number from different platforms
   * @param {string} platform - Chat platform
   * @param {Object} userData - User data from platform
   * @returns {string|null} Phone number if available
   */
  async getUserPhoneNumber(platform, userData) {
    try {
      switch (platform.toLowerCase()) {
        case 'whatsapp':
          // WhatsApp provides phone number directly
          return userData.phone_number || userData.wa_id || null;

        case 'facebook':
        case 'instagram':
          // Facebook/Instagram may have phone in profile
          return userData.phone || userData.phone_number || null;

        case 'line':
          // LINE doesn't provide phone number directly, but we can try to extract from profile
          return userData.phone || null;

        case 'wechat':
          // WeChat doesn't provide phone number directly
          return null;

        case 'threads':
          // Threads (Meta) may have phone in profile
          return userData.phone || userData.phone_number || null;

        default:
          return null;
      }
    } catch (error) {
      logger.error('Failed to extract phone number', {
        platform,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Save contract data to database
   * @param {Object} contractData - Contract data to save
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Object} Save result
   */
  async saveContractData(contractData, conversationId, userId) {
    try {
      const { query } = require('../config/database');

      // Check if contract data already exists for this conversation
      const existingContract = await query(
        'SELECT id FROM contracts WHERE conversation_id = $1',
        [conversationId]
      );

      if (existingContract.rows.length > 0) {
        // Update existing contract
        await query(
          `UPDATE contracts SET 
           contract_data = $1, 
           confidence = $2, 
           updated_at = $3
           WHERE conversation_id = $4`,
          [
            JSON.stringify(contractData.data),
            contractData.confidence,
            new Date(),
            conversationId
          ]
        );
      } else {
        // Insert new contract
        await query(
          `INSERT INTO contracts (
            conversation_id, user_id, platform, contract_data, 
            confidence, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            conversationId,
            userId,
            contractData.platform,
            JSON.stringify(contractData.data),
            contractData.confidence,
            contractData.extractedAt,
            contractData.extractedAt
          ]
        );
      }

      logger.info('Contract data saved', {
        conversationId,
        userId,
        platform: contractData.platform,
        confidence: contractData.confidence
      });

      return {
        success: true,
        message: 'Contract data saved successfully'
      };
    } catch (error) {
      logger.error('Failed to save contract data', {
        conversationId,
        userId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get contract data for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Object} Contract data
   */
  async getContractData(conversationId) {
    try {
      const { query } = require('../config/database');

      const result = await query(
        'SELECT * FROM contracts WHERE conversation_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [conversationId]
      );

      if (result.rows.length > 0) {
        const contract = result.rows[0];
        return {
          success: true,
          data: {
            ...contract,
            contract_data: JSON.parse(contract.contract_data)
          }
        };
      } else {
        return {
          success: false,
          message: 'No contract data found'
        };
      }
    } catch (error) {
      logger.error('Failed to get contract data', {
        conversationId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ContractExtractionService;
