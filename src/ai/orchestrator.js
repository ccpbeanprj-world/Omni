const logger = require('../utils/logger');
const { getAiConfig, getPublicAiStatus } = require('./config');
const { createProvider } = require('./providers');
const AiSettingsStore = require('./settingsStore');

class AiOrchestrator {
  constructor({ db, getRecentMessages, sendMessage } = {}) {
    this.getRecentMessages = getRecentMessages;
    this.sendMessage = sendMessage;
    this.settingsStore = new AiSettingsStore(db);
    const config = getAiConfig();
    this.provider = createProvider(config.requestedProvider, {
      model: config.model,
      maxTokens: config.maxTokens
    });
  }

  async initialize() {
    await this.settingsStore.initialize();
    logger.info('AI orchestrator initialized', {
      type: 'system_init',
      component: 'ai',
      ...getPublicAiStatus(this)
    });
  }

  /**
   * No-op unless flags + opt-in + user inbound + debounce all pass.
   * Never throws to the caller (webhook path).
   */
  async maybeAutoReply(ctx = {}) {
    try {
      const config = getAiConfig();
      const {
        conversationId,
        platform,
        incomingMessage = {}
      } = ctx;

      if (!config.enabled || !config.autoReplyEnabled) {
        return { skipped: true, reason: 'flags_off' };
      }
      if (!conversationId) {
        return { skipped: true, reason: 'no_conversation' };
      }

      const senderType = incomingMessage.sender_type || incomingMessage.senderType;
      const source = incomingMessage.source || incomingMessage.additional_data?.source;
      if (senderType && senderType !== 'user') {
        return { skipped: true, reason: 'not_user' };
      }
      if (source === 'ai') {
        return { skipped: true, reason: 'ai_source' };
      }

      const content = incomingMessage.content || incomingMessage.text;
      if (!content || typeof content !== 'string') {
        return { skipped: true, reason: 'no_text' };
      }

      const settings = await this.settingsStore.getSettings(conversationId);
      if (!settings.autoReplyEnabled) {
        return { skipped: true, reason: 'not_opted_in' };
      }

      if (settings.lastAiReplyAt) {
        const elapsed = Date.now() - new Date(settings.lastAiReplyAt).getTime();
        if (!Number.isNaN(elapsed) && elapsed < config.debounceMs) {
          return { skipped: true, reason: 'debounce' };
        }
      }

      let history = [];
      if (typeof this.getRecentMessages === 'function') {
        try {
          const raw = await this.getRecentMessages(conversationId);
          const list = Array.isArray(raw) ? raw : (raw.messages || []);
          history = list
            .slice(-10)
            .map((m) => ({
              role: m.sender_type === 'user' ? 'user' : 'assistant',
              content: m.content || ''
            }))
            .filter((m) => m.content);
        } catch (historyError) {
          logger.warn('AI history load failed, using inbound only', {
            error: historyError.message,
            conversationId
          });
        }
      }

      if (!history.length) {
        history = [{ role: 'user', content }];
      }

      const reply = await this.provider.generateReply({
        messages: history,
        platform: platform || incomingMessage.platform || 'unknown'
      });

      const text = reply?.text && String(reply.text).trim();
      if (!text) {
        return { skipped: true, reason: 'empty_reply' };
      }

      if (typeof this.sendMessage !== 'function') {
        logger.warn('AI sendMessage not wired');
        return { skipped: true, reason: 'no_send' };
      }

      const targetPlatform = platform || incomingMessage.platform || 'line';
      const result = await this.sendMessage({
        conversationId,
        message: text,
        platform: targetPlatform,
        source: 'ai'
      });

      await this.settingsStore.recordAiReply(conversationId);

      logger.info('AI auto-reply sent', {
        type: 'ai_auto_reply',
        conversationId,
        platform: targetPlatform,
        provider: this.provider.name,
        messageId: result?.messageId || result?.id
      });

      return { skipped: false, result };
    } catch (error) {
      logger.warn('AI auto-reply skipped', { error: error.message });
      return { skipped: true, reason: 'error', error: error.message };
    }
  }
}

module.exports = { AiOrchestrator };
