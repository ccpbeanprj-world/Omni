const express = require('express');
const router = express.Router();
const { getConversations, getConversationMessages, getConversationMessageCount, sendAutoResponse } = require('../services/messageService');
const LineHistoryService = require('../services/lineHistoryService');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    const { status, platform, limit = 50, offset = 0 } = req.query;
    
    logger.info('Getting conversations with params:', { status, platform, limit, offset });
    
    const conversations = await getConversations({
      status,
      platform,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    logger.info('Conversations retrieved:', conversations.length);

    res.json({
      success: true,
      data: conversations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: conversations.length
      }
    });
  } catch (error) {
    logger.error('Failed to get conversations', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      details: error.message
    });
  }
});

// Get specific conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const conversation = await query(
      `SELECT c.*, u.name as user_name, u.platform as user_platform, u.phone, u.email
       FROM conversations c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (conversation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation.rows[0]
    });
  } catch (error) {
    logger.error('Failed to get conversation', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation'
    });
  }
});

// Get conversation message count
router.get('/conversations/:id/message-count', async (req, res) => {
  try {
    const { id } = req.params;
    
    const totalCount = await getConversationMessageCount(id);
    
    res.json({
      success: true,
      data: { total: totalCount }
    });
  } catch (error) {
    logger.error('Failed to get message count', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, order = 'DESC' } = req.query;
    
    const result = await getConversationMessages(
      parseInt(id),
      parseInt(limit),
      parseInt(offset),
      order
    );

    res.json({
      success: true,
      data: result.messages || result, // Handle both formats
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.total || result.length || 0,
        hasMore: result.hasMore || false
      }
    });
  } catch (error) {
    logger.error('Failed to get conversation messages', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Send message to conversation
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', media_url, media_type } = req.body;

    if (!content && !media_url) {
      return res.status(400).json({
        success: false,
        error: 'Message content or media URL is required'
      });
    }

    // Get conversation details
    const conversation = await query(
      'SELECT * FROM conversations WHERE id = $1',
      [id]
    );

    if (conversation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Use MessageService to send message to platform
    const MessageService = require('../services/messageService');
    const messageService = new MessageService();

    const result = await messageService.sendMessageToPlatform(id, {
      content,
      type,
      mediaUrl: media_url,
      mediaType: media_type
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          id: result.messageId,
          content,
          type,
          status: 'sent',
          created_at: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send message to platform'
      });
    }
  } catch (error) {
    logger.error('Failed to send message', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Update conversation status
router.patch('/conversations/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_agent_id } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
    }

    if (assigned_agent_id !== undefined) {
      paramCount++;
      updateFields.push(`assigned_agent_id = $${paramCount}`);
      values.push(assigned_agent_id);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    paramCount++;
    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const conversation = await query(
      `UPDATE conversations 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (conversation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update conversation status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation'
    });
  }
});

// Get users
router.get('/users', async (req, res) => {
  try {
    const { platform, limit = 50, offset = 0 } = req.query;
    
    let queryText = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (platform) {
      paramCount++;
      queryText += ` AND platform = $${paramCount}`;
      params.push(platform);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const users = await query(queryText, params);

    res.json({
      success: true,
      data: users.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: users.rows.length
      }
    });
  } catch (error) {
    logger.error('Failed to get users', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Get platform statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        platform,
        COUNT(*) as conversation_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_conversations
      FROM conversations 
      GROUP BY platform
    `);

    const messageStats = await query(`
      SELECT 
        DATE(created_at) as date,
        platform,
        COUNT(*) as message_count
      FROM messages 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at), platform
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        conversations: stats.rows,
        messages: messageStats.rows
      }
    });
  } catch (error) {
    logger.error('Failed to get statistics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Get enhanced conversation data with comprehensive LINE information
router.get('/conversations/:id/enhanced', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const lineHistoryService = new LineHistoryService();

    // Get conversation details
    const conversationResult = await query(
      `SELECT c.*, u.name, u.profile_picture_url, u.metadata as user_metadata
       FROM conversations c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    const conversation = conversationResult.rows[0];

    // Get enhanced messages
    const messages = await lineHistoryService.getEnhancedConversationMessages(conversationId);

    // Get comprehensive LINE user info if it's a LINE conversation
    let comprehensiveData = null;
    if (conversation.platform === 'line') {
      try {
        comprehensiveData = await lineHistoryService.getUserComprehensiveInfo(conversation.platform_conversation_id);
      } catch (error) {
        logger.warn('Failed to get comprehensive LINE data', error);
      }
    }

    res.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          platform: conversation.platform,
          platform_conversation_id: conversation.platform_conversation_id,
          status: conversation.status,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          user: {
            name: conversation.name,
            profile_picture_url: conversation.profile_picture_url,
            metadata: conversation.user_metadata
          }
        },
        messages: messages,
        comprehensiveData: comprehensiveData
      }
    });
  } catch (error) {
    logger.error('Failed to get enhanced conversation data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enhanced conversation data'
    });
  }
});

// Send auto-response message
router.post('/conversations/:id/auto-response', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, platform } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    await sendAutoResponse(id, message, platform);
    
    res.json({
      success: true,
      message: 'Auto-response sent successfully'
    });
  } catch (error) {
    logger.error('Failed to send auto-response', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send auto-response'
    });
  }
});

// Get auto-response templates by platform
router.get('/auto-responses/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    
    // Default auto-response templates for each platform
    const templates = {
      line: [
        { id: 1, name: '歡迎訊息', message: '您好！歡迎使用我們的LINE服務，我們會盡快回覆您的訊息。' },
        { id: 2, name: '營業時間', message: '我們的營業時間是週一到週五 9:00-18:00，週末及假日休息。' },
        { id: 3, name: '常見問題', message: '如需了解更多資訊，請訪問我們的官網或聯繫客服。' }
      ],
      whatsapp: [
        { id: 1, name: 'Welcome Message', message: 'Hello! Welcome to our WhatsApp service. We will respond to your message as soon as possible.' },
        { id: 2, name: 'Business Hours', message: 'Our business hours are Monday to Friday 9:00-18:00, closed on weekends and holidays.' },
        { id: 3, name: 'FAQ', message: 'For more information, please visit our website or contact customer service.' }
      ],
      facebook: [
        { id: 1, name: 'Welcome Message', message: 'Hello! Thank you for contacting us via Facebook Messenger. We will respond shortly.' },
        { id: 2, name: 'Business Hours', message: 'Our business hours are Monday to Friday 9:00-18:00, closed on weekends and holidays.' },
        { id: 3, name: 'FAQ', message: 'For more information, please visit our website or contact customer service.' }
      ],
      instagram: [
        { id: 1, name: 'Welcome Message', message: 'Hello! Thank you for contacting us via Instagram. We will respond shortly.' },
        { id: 2, name: 'Business Hours', message: 'Our business hours are Monday to Friday 9:00-18:00, closed on weekends and holidays.' },
        { id: 3, name: 'FAQ', message: 'For more information, please visit our website or contact customer service.' }
      ],
      threads: [
        { id: 1, name: 'Welcome Message', message: 'Hello! Thank you for contacting us via Threads. We will respond shortly.' },
        { id: 2, name: 'Business Hours', message: 'Our business hours are Monday to Friday 9:00-18:00, closed on weekends and holidays.' },
        { id: 3, name: 'FAQ', message: 'For more information, please visit our website or contact customer service.' }
      ],
      wechat: [
        { id: 1, name: '歡迎訊息', message: '您好！歡迎使用我們的微信服務，我們會盡快回覆您的訊息。' },
        { id: 2, name: '營業時間', message: '我們的營業時間是週一到週五 9:00-18:00，週末及假日休息。' },
        { id: 3, name: '常見問題', message: '如需了解更多資訊，請訪問我們的官網或聯繫客服。' }
      ]
    };
    
    const platformTemplates = templates[platform] || templates.line;
    
    res.json({
      success: true,
      data: platformTemplates
    });
  } catch (error) {
    logger.error('Failed to get auto-response templates', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-response templates'
    });
  }
});

// Sync all LINE conversations
router.post('/line/sync-all', async (req, res) => {
  try {
    const lineHistoryService = new LineHistoryService();
    const result = await lineHistoryService.syncAllLineConversations();

    res.json({
      success: result.success,
      data: result.results,
      error: result.error
    });
  } catch (error) {
    logger.error('Failed to sync LINE conversations', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync LINE conversations'
    });
  }
});

// Get LINE bot profile information
router.get('/line/bot-profile', async (req, res) => {
  try {
    const LineProfileService = require('../services/lineProfileService');
    const lineProfileService = new LineProfileService();
    
    const botProfile = await lineProfileService.getBotProfile();
    
    if (botProfile) {
      res.json({
        success: true,
        data: botProfile
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'LINE bot profile not found'
      });
    }
  } catch (error) {
    logger.error('Failed to get LINE bot profile', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LINE bot profile'
    });
  }
});

// Get LINE chat history for a user
router.get('/line/chat-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { backward, limit = 50 } = req.query;
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const chatData = await lineChatService.getChatMessages(userId, backward, parseInt(limit));
    
    if (chatData) {
      res.json({
        success: true,
        data: chatData
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Failed to retrieve chat history'
      });
    }
  } catch (error) {
    logger.error('Failed to get LINE chat history', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LINE chat history'
    });
  }
});

// Sync LINE chat history to database
router.post('/line/sync-history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.syncChatHistory(userId, conversationId);
    
    res.json({
      success: result.success,
      data: result,
      error: result.error
    });
  } catch (error) {
    logger.error('Failed to sync LINE chat history', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync LINE chat history'
    });
  }
});

// Send message via LINE Chat API
router.post('/line/send-message', async (req, res) => {
  try {
    const { userId, text, quoteToken } = req.body;
    
    if (!userId || !text) {
      return res.status(400).json({
        success: false,
        error: 'User ID and text are required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.sendMessage(userId, text, quoteToken);
    
    if (result) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send message'
      });
    }
  } catch (error) {
    logger.error('Failed to send LINE message', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send LINE message'
    });
  }
});

// Get LINE chat history for a user
router.get('/line/chat-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { backward, limit = 50 } = req.query;
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const chatData = await lineChatService.getChatMessages(userId, backward, parseInt(limit));
    
    if (chatData) {
      res.json({
        success: true,
        data: chatData
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Failed to retrieve chat history'
      });
    }
  } catch (error) {
    logger.error('Failed to get LINE chat history', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get LINE chat history'
    });
  }
});

// Sync LINE chat history to database
router.post('/line/sync-history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.syncChatHistory(userId, conversationId);
    
    res.json({
      success: result.success,
      data: result,
      error: result.error
    });
  } catch (error) {
    logger.error('Failed to sync LINE chat history', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync LINE chat history'
    });
  }
});

// Send message via LINE Chat API
router.post('/line/send-message', async (req, res) => {
  try {
    const { userId, text, quoteToken } = req.body;
    
    if (!userId || !text) {
      return res.status(400).json({
        success: false,
        error: 'User ID and text are required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.sendMessage(userId, text, quoteToken);
    
    if (result) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send message'
      });
    }
  } catch (error) {
    logger.error('Failed to send LINE message', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send LINE message'
    });
  }
});

// Send LINE sticker
router.post('/line/send-sticker', async (req, res) => {
  try {
    const { userId, packageId, stickerId } = req.body;
    
    if (!userId || !packageId || !stickerId) {
      return res.status(400).json({
        success: false,
        error: 'User ID, package ID, and sticker ID are required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.sendSticker(userId, packageId, stickerId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to send LINE sticker', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send LINE sticker'
    });
  }
});

// Send LINE image
router.post('/line/send-image', async (req, res) => {
  try {
    const { userId, originalContentUrl, previewImageUrl } = req.body;
    
    if (!userId || !originalContentUrl) {
      return res.status(400).json({
        success: false,
        error: 'User ID and original content URL are required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.sendImage(userId, originalContentUrl, previewImageUrl);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to send LINE image', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send LINE image'
    });
  }
});

// Send LINE audio
router.post('/line/send-audio', async (req, res) => {
  try {
    const { userId, originalContentUrl, duration } = req.body;
    
    if (!userId || !originalContentUrl || !duration) {
      return res.status(400).json({
        success: false,
        error: 'User ID, original content URL, and duration are required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.sendAudio(userId, originalContentUrl, duration);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to send LINE audio', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send LINE audio'
    });
  }
});

// Send LINE document
router.post('/line/send-document', async (req, res) => {
  try {
    const { userId, originalContentUrl, filename } = req.body;
    
    if (!userId || !originalContentUrl || !filename) {
      return res.status(400).json({
        success: false,
        error: 'User ID, original content URL, and filename are required'
      });
    }
    
    const LineChatApiService = require('../services/lineChatApiService');
    const lineChatService = new LineChatApiService();
    
    const result = await lineChatService.sendDocument(userId, originalContentUrl, filename);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to send LINE document', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send LINE document'
    });
  }
});

// Extract contract data from message
router.post('/contracts/extract', async (req, res) => {
  try {
    const { content, platform, conversationId, userId, userInfo } = req.body;
    
    if (!content || !platform || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Content, platform, and conversation ID are required'
      });
    }
    
    const ContractExtractionService = require('../services/contractExtractionService');
    const contractService = new ContractExtractionService();
    
    const contractData = contractService.extractContractData(content, platform, userInfo);
    
    if (contractData && contractData.confidence > 30) {
      // Save contract data to database
      const saveResult = await contractService.saveContractData(contractData, conversationId, userId);
      
      res.json({
        success: true,
        data: {
          contractData,
          saved: saveResult.success
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          contractData,
          saved: false,
          message: 'Low confidence score, not saved'
        }
      });
    }
  } catch (error) {
    logger.error('Failed to extract contract data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract contract data'
    });
  }
});

// Get contract data for conversation
router.get('/contracts/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const ContractExtractionService = require('../services/contractExtractionService');
    const contractService = new ContractExtractionService();
    
    const result = await contractService.getContractData(conversationId);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to get contract data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contract data'
    });
  }
});

// Get user phone number from platform
router.get('/users/:userId/phone/:platform', async (req, res) => {
  try {
    const { userId, platform } = req.params;
    
    const ContractExtractionService = require('../services/contractExtractionService');
    const contractService = new ContractExtractionService();
    
    // Get user data from database
    const { query } = require('../config/database');
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1 AND platform = $2',
      [userId, platform]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userData = userResult.rows[0];
    const phoneNumber = await contractService.getUserPhoneNumber(platform, userData);
    
    res.json({
      success: true,
      data: {
        userId,
        platform,
        phoneNumber,
        userData: {
          name: userData.name,
          email: userData.email,
          profile_picture_url: userData.profile_picture_url
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get user phone number', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user phone number'
    });
  }
});

module.exports = router;
