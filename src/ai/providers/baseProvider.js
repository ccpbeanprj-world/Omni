/**
 * LLM provider interface. New providers implement generateReply only.
 */
class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * @param {{ messages: Array<{role: string, content: string}>, platform: string }} _ctx
   * @returns {Promise<{ text: string, source: string }>}
   */
  async generateReply(_ctx) {
    throw new Error('generateReply must be implemented by subclass');
  }
}

module.exports = BaseProvider;
