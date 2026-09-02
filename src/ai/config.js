/**
 * AI feature flags. All default off so missing env does not change chat behavior.
 * Never put API keys on this object — status APIs serialize it.
 */

const { hasSecret } = require('../config/secrets');

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).toLowerCase() === 'true' || value === '1';
}

function getAiConfig() {
  const requestedProvider = (process.env.AI_PROVIDER || 'stub').toLowerCase();
  const claudeConfigured = hasSecret('ANTHROPIC_API_KEY');
  const wantsClaude = requestedProvider === 'claude' || requestedProvider === 'anthropic';
  const provider = wantsClaude && claudeConfigured ? 'claude' : 'stub';

  return {
    enabled: parseBool(process.env.AI_ENABLED, false),
    autoReplyEnabled: parseBool(process.env.AI_AUTO_REPLY_ENABLED, false),
    provider,
    requestedProvider,
    claudeConfigured,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '512', 10),
    debounceMs: parseInt(process.env.AI_DEBOUNCE_MS || '30000', 10)
  };
}

function getPublicAiStatus(orchestrator) {
  const config = getAiConfig();
  const providerName = orchestrator?.provider?.name || config.provider;
  return {
    enabled: config.enabled,
    autoReplyEnabled: config.autoReplyEnabled,
    provider: providerName,
    requestedProvider: config.requestedProvider,
    claudeConfigured: config.claudeConfigured,
    model: providerName === 'claude' ? config.model : undefined,
    debounceMs: config.debounceMs
  };
}

module.exports = { getAiConfig, getPublicAiStatus, parseBool };
