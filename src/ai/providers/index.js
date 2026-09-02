const logger = require('../../utils/logger');
const { getSecret, hasSecret } = require('../../config/secrets');
const StubProvider = require('./stubProvider');
const ClaudeProvider = require('./claudeProvider');

/**
 * Build an LLM provider. Missing Claude keys fall back to stub so chat never breaks.
 */
function createProvider(name, options = {}) {
  const requested = String(name || options.provider || 'stub').toLowerCase();

  if (requested === 'claude' || requested === 'anthropic') {
    if (!hasSecret('ANTHROPIC_API_KEY')) {
      logger.warn('AI_PROVIDER is claude but ANTHROPIC_API_KEY is not set; using stub', {
        type: 'ai_provider',
        requested
      });
      return new StubProvider();
    }
    return new ClaudeProvider({
      apiKey: getSecret('ANTHROPIC_API_KEY'),
      model: options.model,
      maxTokens: options.maxTokens
    });
  }

  if (requested === 'stub' || !requested) {
    return new StubProvider();
  }

  logger.warn('Unknown AI_PROVIDER, falling back to stub', { provider: requested });
  return new StubProvider();
}

module.exports = { createProvider };
