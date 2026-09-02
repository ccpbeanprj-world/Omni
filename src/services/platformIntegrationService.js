// src/services/multiPlatformService.js
class MultiPlatformService {
  constructor() {
    this.platforms = {
      line: {
        name: 'LINE',
        color: '#00C300',
        icon: '💬',
        apiUrl: 'https://api.line.me/v2'
      },
      whatsapp: {
        name: 'WhatsApp',
        color: '#25D366',
        icon: '📱',
        apiUrl: 'https://graph.facebook.com/v18.0'
      },
      facebook: {
        name: 'Facebook Messenger',
        color: '#1877F2',
        icon: '👥',
        apiUrl: 'https://graph.facebook.com/v18.0'
      },
      wechat: {
        name: 'WeChat',
        color: '#07C160',
        icon: '💚',
        apiUrl: 'https://api.weixin.qq.com'
      },
      instagram: {
        name: 'Instagram',
        color: '#E4405F',
        icon: '📸',
        apiUrl: 'https://graph.facebook.com/v18.0'
      },
      threads: {
        name: 'Threads',
        color: '#000000',
        icon: '🧵',
        apiUrl: 'https://graph.facebook.com/v18.0'
      }
    };
  }

  getPlatformInfo(platform) {
    return this.platforms[platform] || {
      name: platform.charAt(0).toUpperCase() + platform.slice(1),
      color: '#6366F1',
      icon: '💬',
      apiUrl: null
    };
  }

  generateUserIcon(userId, platform) {
    const platformInfo = this.getPlatformInfo(platform);
    return `https://api.dicebear.com/7.x/initials/svg?seed=${userId}&backgroundColor=${platformInfo.color.replace('#', '')}&textColor=ffffff&size=150`;
  }

  formatLastMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-TW', {
        month: '2-digit',
        day: '2-digit'
      });
    }
  }

  truncateMessage(message, maxLength = 50) {
    if (!message) return '';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  }
}

module.exports = MultiPlatformService;