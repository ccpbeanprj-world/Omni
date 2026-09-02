const express = require('express');
const logger = require('../utils/logger');
const { getPublicAiStatus } = require('./config');

function createAiRouter(orchestrator) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json({
      success: true,
      data: getPublicAiStatus(orchestrator)
    });
  });

  router.get('/conversations/:id/settings', async (req, res) => {
    try {
      const settings = await orchestrator.settingsStore.getSettings(req.params.id);
      res.json({
        success: true,
        data: {
          conversationId: req.params.id,
          autoReplyEnabled: settings.autoReplyEnabled === true
        }
      });
    } catch (error) {
      logger.warn('AI settings get failed', { error: error.message });
      res.json({
        success: true,
        data: {
          conversationId: req.params.id,
          autoReplyEnabled: false
        }
      });
    }
  });

  router.patch('/conversations/:id/settings', async (req, res) => {
    try {
      const enabled = Boolean(req.body?.autoReplyEnabled);
      const settings = await orchestrator.settingsStore.setAutoReplyEnabled(
        req.params.id,
        enabled
      );
      res.json({
        success: true,
        data: {
          conversationId: req.params.id,
          autoReplyEnabled: settings.autoReplyEnabled === true
        }
      });
    } catch (error) {
      logger.warn('AI settings patch failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update AI settings'
      });
    }
  });

  return router;
}

module.exports = { createAiRouter };
