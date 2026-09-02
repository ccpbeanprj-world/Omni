const BaseProvider = require('./baseProvider');

/**
 * No-network stub. Lets the auto-reply path be tested without an API key.
 */
class StubProvider extends BaseProvider {
  constructor() {
    super('stub');
  }

  async generateReply({ messages = [], platform = 'unknown' } = {}) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const snippet = lastUser?.content
      ? String(lastUser.content).slice(0, 80)
      : 'your message';

    return {
      text: `[AI stub] Thanks for writing on ${platform}. We received: "${snippet}". An agent will follow up shortly.`,
      source: 'ai'
    };
  }
}

module.exports = StubProvider;
