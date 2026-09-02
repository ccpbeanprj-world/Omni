import type { Platform, PlatformIcon } from '../types';

export const platformConfigs: Record<Platform, PlatformIcon> = {
  whatsapp: {
    name: 'WhatsApp',
    icon: '📱',
    color: '#25D366'
  },
  facebook: {
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2'
  },
  wechat: {
    name: 'WeChat',
    icon: '💬',
    color: '#09B83E'
  },
  instagram: {
    name: 'Instagram',
    icon: '📷',
    color: '#E4405F'
  },
  line: {
    name: 'LINE',
    icon: '💚',
    color: '#00B900'
  },
  threads: {
    name: 'Threads',
    icon: '🧵',
    color: '#000000'
  }
};

export const getPlatformConfig = (platform: string): PlatformIcon => {
  const config = platformConfigs[platform as Platform];
  return config || {
    name: platform || 'Unknown',
    icon: '💬',
    color: '#666666'
  };
};

export const getDefaultAvatar = (platform: string): string => {
  const config = getPlatformConfig(platform);
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="35" height="35" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="17.5" cy="17.5" r="17.5" fill="${config.color}"/>
      <text x="17.5" y="22" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${config.icon}</text>
    </svg>
  `)}`;
};

export const getAgentAvatar = (): string => {
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="35" height="35" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="17.5" cy="17.5" r="17.5" fill="#667eea"/>
      <text x="17.5" y="22" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">A</text>
    </svg>
  `)}`;
};





