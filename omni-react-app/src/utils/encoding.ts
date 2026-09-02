// omni-react-app/src/utils/encoding.ts
// Utility functions to handle encoding issues

/**
 * Safely encode string to base64, handling Unicode characters
 */
export function safeBtoa(str: string): string {
  try {
    return btoa(str);
  } catch (error) {
    // If btoa fails due to Unicode characters, encode to UTF-8 first
    return btoa(unescape(encodeURIComponent(str)));
  }
}

/**
 * Safely decode base64 string
 */
export function safeAtob(str: string): string {
  try {
    return atob(str);
  } catch (error) {
    console.error('Failed to decode base64 string:', error);
    return str;
  }
}

/**
 * Sanitize string to prevent encoding issues
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  // Replace non-ASCII characters with safe alternatives
  return str.replace(/[^\x00-\x7F]/g, '?');
}

/**
 * Sanitize object properties to prevent encoding issues
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}
















