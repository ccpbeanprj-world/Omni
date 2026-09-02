const logger = require('../utils/logger');

/**
 * Per-conversation AI opt-in. New SQLite table only — never ALTERs conversations/messages.
 * Falls back to an in-memory Map if SQLite is unavailable.
 */
class AiSettingsStore {
  constructor(db) {
    this.db = db;
    this.memory = new Map();
    this.useSqlite = false;
  }

  async initialize() {
    if (!this.db) {
      logger.warn('AI settings store using in-memory fallback (no SQLite)');
      return;
    }

    try {
      await this.run(
        `CREATE TABLE IF NOT EXISTS ai_conversation_settings (
          conversation_id TEXT PRIMARY KEY,
          auto_reply_enabled INTEGER DEFAULT 0,
          last_ai_reply_at TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      );
      this.useSqlite = true;
    } catch (error) {
      logger.warn('AI settings table init failed, using in-memory fallback', {
        error: error.message
      });
      this.useSqlite = false;
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  defaultSettings(conversationId) {
    return {
      conversationId,
      autoReplyEnabled: false,
      lastAiReplyAt: null
    };
  }

  async getSettings(conversationId) {
    if (!conversationId) {
      return this.defaultSettings(conversationId);
    }

    if (!this.useSqlite) {
      return this.memory.get(conversationId) || this.defaultSettings(conversationId);
    }

    try {
      const row = await this.get(
        'SELECT conversation_id, auto_reply_enabled, last_ai_reply_at FROM ai_conversation_settings WHERE conversation_id = ?',
        [conversationId]
      );
      if (!row) {
        return this.defaultSettings(conversationId);
      }
      return {
        conversationId: row.conversation_id,
        autoReplyEnabled: row.auto_reply_enabled === 1,
        lastAiReplyAt: row.last_ai_reply_at || null
      };
    } catch (error) {
      logger.warn('AI settings read failed', { error: error.message, conversationId });
      return this.defaultSettings(conversationId);
    }
  }

  async setAutoReplyEnabled(conversationId, enabled) {
    const autoReplyEnabled = Boolean(enabled);
    const updatedAt = new Date().toISOString();

    if (!this.useSqlite) {
      const current = this.memory.get(conversationId) || this.defaultSettings(conversationId);
      const next = { ...current, conversationId, autoReplyEnabled };
      this.memory.set(conversationId, next);
      return next;
    }

    await this.run(
      `INSERT INTO ai_conversation_settings (conversation_id, auto_reply_enabled, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         auto_reply_enabled = excluded.auto_reply_enabled,
         updated_at = excluded.updated_at`,
      [conversationId, autoReplyEnabled ? 1 : 0, updatedAt]
    );

    return this.getSettings(conversationId);
  }

  async recordAiReply(conversationId) {
    const lastAiReplyAt = new Date().toISOString();

    if (!this.useSqlite) {
      const current = this.memory.get(conversationId) || this.defaultSettings(conversationId);
      this.memory.set(conversationId, { ...current, conversationId, lastAiReplyAt });
      return;
    }

    await this.run(
      `INSERT INTO ai_conversation_settings (conversation_id, auto_reply_enabled, last_ai_reply_at, updated_at)
       VALUES (?, 0, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         last_ai_reply_at = excluded.last_ai_reply_at,
         updated_at = excluded.updated_at`,
      [conversationId, lastAiReplyAt, lastAiReplyAt]
    );
  }
}

module.exports = AiSettingsStore;
