// omni-react-app/src/utils/platformUtils.ts
export interface PlatformInfo {
  name: string;
  icon: string;
  color: string;
  backgroundColor: string;
  textColor: string;
}

export const PLATFORM_CONFIGS: Record<string, PlatformInfo> = {
  line: {
    name: 'LINE',
    icon: '💬',
    color: '#00C300',
    backgroundColor: '#00C300',
    textColor: '#FFFFFF'
  },
  whatsapp: {
    name: 'WhatsApp',
    icon: '📱',
    color: '#25D366',
    backgroundColor: '#25D366',
    textColor: '#FFFFFF'
  },
  facebook: {
    name: 'Facebook',
    icon: '👥',
    color: '#1877F2',
    backgroundColor: '#1877F2',
    textColor: '#FFFFFF'
  },
  wechat: {
    name: 'WeChat',
    icon: '💚',
    color: '#07C160',
    backgroundColor: '#07C160',
    textColor: '#FFFFFF'
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    color: '#E4405F',
    backgroundColor: '#E4405F',
    textColor: '#FFFFFF'
  },
  threads: {
    name: 'Threads',
    icon: '🧵',
    color: '#000000',
    backgroundColor: '#000000',
    textColor: '#FFFFFF'
  }
};

export function getPlatformInfo(platform: string): PlatformInfo {
  return PLATFORM_CONFIGS[platform.toLowerCase()] || {
    name: platform.charAt(0).toUpperCase() + platform.slice(1),
    icon: '💬',
    color: '#6366F1',
    backgroundColor: '#6366F1',
    textColor: '#FFFFFF'
  };
}

export function formatLastMessageTime(timestamp: string): string {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

export function truncateMessage(message: string, maxLength: number = 50): string {
  if (!message) return '';
  return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
}

export function getOnlineStatus(user: any): { status: string; color: string; text: string } {
  if (!user) return { status: 'offline', color: '#9CA3AF', text: '離線' };
  
  // Check if user has last_seen information
  if (user.last_seen) {
    const lastSeen = new Date(user.last_seen);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) {
      return { status: 'online', color: '#10B981', text: '線上' };
    } else if (diffMinutes < 60) {
      return { status: 'recent', color: '#F59E0B', text: `${diffMinutes}分鐘前` };
    }
  }
  
  return { status: 'offline', color: '#9CA3AF', text: '離線' };
}





