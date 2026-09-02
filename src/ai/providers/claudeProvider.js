const axios = require('axios');
const BaseProvider = require('./baseProvider');
const logger = require('../../utils/logger');

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Claude (Anthropic Messages API). API key is never logged or returned.
 */
class ClaudeProvider extends BaseProvider {
  constructor({ apiKey, model, maxTokens, version } = {}) {
    super('claude');
    this._apiKey = apiKey;
    this.model = model || 'claude-sonnet-4-5';
    this.maxTokens = maxTokens || 512;
    this.version = version || '2023-06-01';
  }

  async generateReply({ messages = [], platform = 'unknown' } = {}) {
    if (!this._apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const conversation = messages
      .filter((m) => m && m.content)
      .slice(-10)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 4000)
      }));

    if (!conversation.length) {
      conversation.push({ role: 'user', content: 'Hello' });
    }

    // Anthropic requires alternating roles starting with user
    if (conversation[0].role !== 'user') {
      conversation.unshift({ role: 'user', content: '(previous agent context)' });
    }

    const response = await axios.post(
      ANTHROPIC_MESSAGES_URL,
      {
        model: this.model,
        max_tokens: this.maxTokens,
        system: `You are a concise customer-support assistant for OmniChat (${platform}). Reply in the customer's language. Do not mention being an AI unless asked. Do not invent account data, prices, or policies. Keep replies under 80 words.`,
        messages: conversation
      },
      {
        timeout: 20000,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this._apiKey,
          'anthropic-version': this.version
        },
        validateStatus: () => true
      }
    );

    if (response.status >= 400) {
      logger.warn('Claude API request failed', {
        type: 'ai_provider',
        provider: 'claude',
        status: response.status,
        errorType: response.data?.error?.type
      });
      throw new Error(`Claude API error ${response.status}`);
    }

    const text = (response.data?.content || [])
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) {
      throw new Error('Claude returned an empty reply');
    }

    return { text, source: 'ai' };
  }
}

module.exports = ClaudeProvider;
