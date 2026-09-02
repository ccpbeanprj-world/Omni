/**
 * Secret access and log redaction. Never log return values from getSecret.
 */

const SENSITIVE_KEY = /(token|secret|password|passwd|api[_-]?key|authorization|cookie|private[_-]?key|access[_-]?token|refresh[_-]?token|encryption[_-]?key|jwt|channel_secret|auth_token)/i;

const SECRET_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-[A-Za-z0-9]{16,}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]{8,}\b/gi
];

function isSensitiveKey(key) {
  return typeof key === 'string' && SENSITIVE_KEY.test(key);
}

function redactString(value) {
  if (typeof value !== 'string' || value.length < 8) {
    return value;
  }
  let next = value;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, '[REDACTED]');
  }
  return next;
}

function redactDeep(value, depth = 0) {
  if (value == null || depth > 8) {
    return value;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactString(value.message || ''),
        stack: value.stack ? redactString(value.stack) : undefined
      };
    }
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        out[key] = nested ? '[REDACTED]' : nested;
      } else {
        out[key] = redactDeep(nested, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function getSecret(name) {
  const raw = process.env[name];
  if (raw == null) {
    return '';
  }
  return String(raw).trim();
}

function hasSecret(name) {
  return getSecret(name).length > 0;
}

module.exports = {
  getSecret,
  hasSecret,
  redactDeep,
  redactString,
  isSensitiveKey
};
