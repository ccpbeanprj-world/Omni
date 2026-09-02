const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { processIncomingMessage } = require('../services/messageService');
const { cache } = require('../config/redis');

// Platform adapters
const WhatsAppAdapter = require('../adapters/WhatsAppAdapter');
const FacebookAdapter = require('../adapters/FacebookAdapter');
const WeChatAdapter = require('../adapters/WeChatAdapter');
const InstagramAdapter = require('../adapters/InstagramAdapter');
const LineAdapter = require('../adapters/LineAdapter');
const ThreadsAdapter = require('../adapters/ThreadsAdapter');

// Initialize adapters
const whatsappAdapter = new WhatsAppAdapter({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN
});

const facebookAdapter = new FacebookAdapter({
  accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  pageId: process.env.FACEBOOK_PAGE_ID,
  verifyToken: process.env.FACEBOOK_VERIFY_TOKEN
});

const wechatAdapter = new WeChatAdapter({
  appId: process.env.WECHAT_APP_ID,
  appSecret: process.env.WECHAT_APP_SECRET,
  token: process.env.WECHAT_TOKEN,
  encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY
});

const instagramAdapter = new InstagramAdapter({
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  pageId: process.env.INSTAGRAM_PAGE_ID,
  verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN
});

const lineAdapter = new LineAdapter({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

const threadsAdapter = new ThreadsAdapter({
  accessToken: process.env.THREADS_ACCESS_TOKEN,
  pageId: process.env.THREADS_PAGE_ID,
  verifyToken: process.env.THREADS_VERIFY_TOKEN
});

// WhatsApp webhook
router.get('/whatsapp', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // For WhatsApp Sandbox, we can skip verification or use a simple check
    if (mode === 'subscribe') {
      // If verify_token is provided, check it; otherwise, accept any challenge
      if (token && token !== process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.warn('WhatsApp webhook verification failed', {
          mode,
          token,
          expected: process.env.WHATSAPP_VERIFY_TOKEN
        });
        return res.status(403).send('Forbidden');
      }
      
      logger.info('WhatsApp webhook verified (Sandbox mode)');
      res.status(200).send(challenge || 'OK');
    } else {
      logger.warn('WhatsApp webhook verification failed - invalid mode', { mode });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('WhatsApp webhook verification error', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/whatsapp', async (req, res) => {
  try {
    logger.webhookLog('whatsapp', 'received', { body: req.body });
    
    // Validate webhook signature
    const signature = req.headers['x-hub-signature-256'];
    if (!whatsappAdapter.validateWebhook(req.body, signature)) {
      logger.warn('Invalid WhatsApp webhook signature');
      return res.status(403).send('Forbidden');
    }

    // Process webhook
    const messages = await whatsappAdapter.processWebhook(req.body);
    
    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('WhatsApp webhook processing error', error);
    res.status(500).send('Internal Server Error');
  }
});

// Facebook webhook
router.get('/facebook', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      logger.info('Facebook webhook verified');
      res.status(200).send(challenge);
    } else {
      logger.warn('Facebook webhook verification failed', {
        mode,
        token,
        expected: process.env.FACEBOOK_VERIFY_TOKEN
      });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('Facebook webhook verification error', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/facebook', async (req, res) => {
  try {
    logger.webhookLog('facebook', 'received', { body: req.body });
    
    // Validate webhook signature
    const signature = req.headers['x-hub-signature-256'];
    if (!facebookAdapter.validateWebhook(req.body, signature)) {
      logger.warn('Invalid Facebook webhook signature');
      return res.status(403).send('Forbidden');
    }

    // Process webhook
    const messages = await facebookAdapter.processWebhook(req.body);
    
    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Facebook webhook processing error', error);
    res.status(500).send('Internal Server Error');
  }
});

// WeChat webhook
router.get('/wechat', async (req, res) => {
  try {
    const { signature, timestamp, nonce, echostr } = req.query;
    
    if (wechatAdapter.validateWebhook({ query: req.query }, signature)) {
      logger.info('WeChat webhook verified');
      res.status(200).send(echostr);
    } else {
      logger.warn('WeChat webhook verification failed', {
        signature,
        timestamp,
        nonce
      });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('WeChat webhook verification error', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/wechat', async (req, res) => {
  try {
    logger.webhookLog('wechat', 'received', { body: req.body });
    
    // Validate webhook signature
    const { signature, timestamp, nonce } = req.query;
    if (!wechatAdapter.validateWebhook({ query: req.query }, signature)) {
      logger.warn('Invalid WeChat webhook signature');
      return res.status(403).send('Forbidden');
    }

    // Process webhook
    const messages = await wechatAdapter.processWebhook({ body: req.body });
    
    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message);
    }

    res.status(200).send('success');
  } catch (error) {
    logger.error('WeChat webhook processing error', error);
    res.status(500).send('Internal Server Error');
  }
});

// Instagram webhook
router.get('/instagram', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
      logger.info('Instagram webhook verified');
      res.status(200).send(challenge);
    } else {
      logger.warn('Instagram webhook verification failed', {
        mode,
        token,
        expected: process.env.INSTAGRAM_VERIFY_TOKEN
      });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('Instagram webhook verification error', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/instagram', async (req, res) => {
  try {
    logger.webhookLog('instagram', 'received', { body: req.body });
    
    // Validate webhook signature
    const signature = req.headers['x-hub-signature-256'];
    if (!instagramAdapter.validateWebhook(req.body, signature)) {
      logger.warn('Invalid Instagram webhook signature');
      return res.status(403).send('Forbidden');
    }

    // Process webhook
    const messages = await instagramAdapter.processWebhook(req.body);
    
    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Instagram webhook processing error', error);
    res.status(500).send('Internal Server Error');
  }
});

// LINE webhook
router.get('/line', async (req, res) => {
  try {
    // LINE doesn't require verification, just return OK
    res.status(200).send('OK');
  } catch (error) {
    logger.error('LINE webhook verification error', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/line', async (req, res) => {
  try {
    logger.webhookLog('line', 'received', { body: req.body });
    console.log('🔵 LINE webhook received:', JSON.stringify(req.body, null, 2));
    
    // Validate webhook signature
    const signature = req.headers['x-line-signature'];
    console.log('🔐 LINE signature:', signature);
    
    if (!lineAdapter.validateWebhook(req.body, signature)) {
      logger.warn('Invalid LINE webhook signature');
      console.log('❌ LINE webhook signature validation failed');
      return res.status(403).send('Forbidden');
    }

    console.log('✅ LINE webhook signature validated');
    
    // Process webhook
    console.log('🔄 Processing LINE webhook...');
    const messages = await lineAdapter.processWebhook(req.body);
    console.log('📨 Processed messages:', messages.length, messages);
    
    // Process each message
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      console.log(`🔄 Processing message ${i + 1}/${messages.length}:`, JSON.stringify(message, null, 2));
      
      try {
        await processIncomingMessage(message);
        console.log(`✅ Message ${i + 1} processed successfully`);
      } catch (messageError) {
        console.error(`❌ Message ${i + 1} processing failed:`, messageError);
        logger.error(`Failed to process message ${i + 1}`, messageError);
      }
    }

    console.log('✅ LINE webhook processing completed');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ LINE webhook processing error:', error);
    logger.error('LINE webhook processing error', error);
    res.status(500).send('Internal Server Error');
  }
});

// Threads webhook
router.get('/threads', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.THREADS_VERIFY_TOKEN) {
      logger.info('Threads webhook verified');
      res.status(200).send(challenge);
    } else {
      logger.warn('Threads webhook verification failed', {
        mode,
        token,
        expected: process.env.THREADS_VERIFY_TOKEN
      });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('Threads webhook verification error', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/threads', async (req, res) => {
  try {
    logger.webhookLog('threads', 'received', { body: req.body });
    
    // Validate webhook signature
    const signature = req.headers['x-hub-signature-256'];
    if (!threadsAdapter.validateWebhook(req.body, signature)) {
      logger.warn('Invalid Threads webhook signature');
      return res.status(403).send('Forbidden');
    }

    // Process webhook
    const messages = await threadsAdapter.processWebhook(req.body);
    
    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Threads webhook processing error', error);
    res.status(500).send('Internal Server Error');
  }
});

// Generic webhook status endpoint
router.get('/status', async (req, res) => {
  try {
    const status = {
      whatsapp: {
        configured: !!process.env.WHATSAPP_ACCESS_TOKEN,
        webhook_url: process.env.WHATSAPP_WEBHOOK_URL
      },
      facebook: {
        configured: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
        webhook_url: process.env.FACEBOOK_WEBHOOK_URL
      },
      wechat: {
        configured: !!process.env.WECHAT_APP_ID,
        webhook_url: process.env.WECHAT_WEBHOOK_URL
      },
      instagram: {
        configured: !!process.env.INSTAGRAM_ACCESS_TOKEN,
        webhook_url: process.env.INSTAGRAM_WEBHOOK_URL
      },
      line: {
        configured: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        webhook_url: process.env.LINE_WEBHOOK_URL
      },
      threads: {
        configured: !!process.env.THREADS_ACCESS_TOKEN,
        webhook_url: process.env.THREADS_WEBHOOK_URL
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(status);
  } catch (error) {
    logger.error('Webhook status error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
