// omni-react-app/src/utils/userIcons.ts
export interface UserIconConfig {
  userId: string;
  userName: string;
  platform: string;
  profilePictureUrl?: string;
}

export class UserIconManager {
  private static instance: UserIconManager;
  private userIcons: Map<string, string> = new Map();
  private defaultIcons: Map<string, string> = new Map();

  private constructor() {
    this.initializeDefaultIcons();
  }

  public static getInstance(): UserIconManager {
    if (!UserIconManager.instance) {
      UserIconManager.instance = new UserIconManager();
    }
    return UserIconManager.instance;
  }

  private initializeDefaultIcons() {
    // Default profile pictures for different platforms using reliable sources
    this.defaultIcons.set('line', 'https://api.dicebear.com/7.x/initials/svg?seed=Bean%20Chan&backgroundColor=4CAF50&textColor=ffffff&size=150');
    this.defaultIcons.set('whatsapp', 'https://api.dicebear.com/7.x/avataaars/svg?seed=WhatsApp&backgroundColor=25D366&size=150');
    this.defaultIcons.set('facebook', 'https://api.dicebear.com/7.x/personas/svg?seed=Facebook&backgroundColor=1877F2&size=150');
    this.defaultIcons.set('wechat', 'https://api.dicebear.com/7.x/bottts/svg?seed=WeChat&backgroundColor=07C160&size=150');
    this.defaultIcons.set('instagram', 'https://api.dicebear.com/7.x/initials/svg?seed=Instagram&backgroundColor=E4405F&textColor=ffffff&size=150');
    this.defaultIcons.set('threads', 'https://api.dicebear.com/7.x/micah/svg?seed=Threads&backgroundColor=000000&size=150');
  }

  // Get user icon with fallback system
  public getUserIcon(config: UserIconConfig): string {
    const { userId, userName, platform, profilePictureUrl } = config;
    
    // Priority 1: If user has a real profile picture URL, use it directly
    // Use real profile picture if available and not a generic DiceBear URL
    if (profilePictureUrl && profilePictureUrl.startsWith('http') && !profilePictureUrl.includes('dicebear.com')) {
      console.log(`✅ Using real profile picture for ${userName}: ${profilePictureUrl}`);
      this.userIcons.set(userId, profilePictureUrl);
      return profilePictureUrl;
    }
    
    // Priority 1.5: If profilePictureUrl is null or empty, generate a proper fallback
    if (!profilePictureUrl || profilePictureUrl === null) {
      console.log(`🔄 Generating fallback profile picture for ${userName} (no real picture available)`);
      const fallbackUrl = this.generateFallbackIcon(userId, userName, platform);
      this.userIcons.set(userId, fallbackUrl);
      return fallbackUrl;
    }

    // Priority 2: If we already have a cached icon for this user, use it
    if (this.userIcons.has(userId)) {
      return this.userIcons.get(userId)!;
    }

    // Priority 3: Generate a consistent icon based on user ID and platform
    const iconUrl = this.generateUserIcon(userId, userName, platform);
    this.userIcons.set(userId, iconUrl);
    console.log(`🔄 Generated dynamic icon for ${userName}: ${iconUrl}`);
    return iconUrl;
  }

  // Generate consistent user icon based on user ID
  private generateUserIcon(userId: string, userName: string, platform: string): string {
    // Use a hash of the user ID to get consistent colors
    const hash = this.hashString(userId);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    
    const colorIndex = hash % colors.length;
    const backgroundColor = colors[colorIndex];
    
    // Get first letter of username for initials
    const initial = userName ? userName.charAt(0).toUpperCase() : 'U';
    
    // Generate a consistent seed using the user name
    const seed = userName || userId;
    
    // Use reliable avatar services with fallbacks
    switch (platform.toLowerCase()) {
      case 'line':
        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${backgroundColor.replace('#', '')}&textColor=ffffff&size=150`;
      case 'whatsapp':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=${backgroundColor.replace('#', '')}&size=150`;
      case 'facebook':
        return `https://api.dicebear.com/7.x/personas/svg?seed=${seed}&backgroundColor=${backgroundColor.replace('#', '')}&size=150`;
      case 'wechat':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=${backgroundColor.replace('#', '')}&size=150`;
      case 'instagram':
        return `https://api.dicebear.com/7.x/initials/svg?seed=${initial}&backgroundColor=${backgroundColor.replace('#', '')}&textColor=ffffff&size=150`;
      case 'threads':
        return `https://api.dicebear.com/7.x/micah/svg?seed=${seed}&backgroundColor=${backgroundColor.replace('#', '')}&size=150`;
      default:
        return `https://api.dicebear.com/7.x/initials/svg?seed=${initial}&backgroundColor=${backgroundColor.replace('#', '')}&textColor=ffffff&size=150`;
    }
  }

  // Simple hash function for consistent user ID hashing
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Get platform icon
  public getPlatformIcon(platform: string): string {
    const platformIcons: Record<string, string> = {
      line: 'https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg',
      whatsapp: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
      facebook: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
      wechat: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/WeChat_logo.svg',
      instagram: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png',
      threads: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Threads_%28app%29_logo.svg'
    };
    
    return platformIcons[platform.toLowerCase()] || platformIcons.line;
  }

  // Clear user icon cache (useful for testing)
  public clearCache(): void {
    this.userIcons.clear();
  }

  // Get all cached user icons
  public getCachedIcons(): Map<string, string> {
    return new Map(this.userIcons);
  }
  // Generate fallback icon when no real profile picture is available
  private generateFallbackIcon(userId: string, userName: string, platform: string): string {
    // Use user name as seed for consistent fallback
    const seed = userName || userId;
    const backgroundColor = this.getPlatformColor(platform);
    
    // Generate a simple initial-based icon (initial unused, seed used instead)
    // const initial = userName ? userName.charAt(0).toUpperCase() : 'U'; // Unused
    
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=${backgroundColor.replace('#', '')}&textColor=ffffff&size=150`;
  }

  // Get platform-specific color
  private getPlatformColor(platform: string): string {
    const platformColors: Record<string, string> = {
      line: '#00C300',
      whatsapp: '#25D366',
      facebook: '#1877F2',
      wechat: '#07C160',
      instagram: '#E4405F',
      threads: '#000000',
      omni: '#3B82F6'
    };
    
    return platformColors[platform.toLowerCase()] || '#6B7280';
  }
}

// React hook for using user icons
import { useState, useEffect } from 'react';

export const useUserIcon = (config: UserIconConfig) => {
  const [iconUrl, setIconUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const iconManager = UserIconManager.getInstance();
    const icon = iconManager.getUserIcon(config);
    setIconUrl(icon);
    setIsLoading(false);
  }, [config.userId, config.userName, config.platform, config.profilePictureUrl]);

  const handleImageError = () => {
    setHasError(true);
    // Fallback to initials-based icon
    const iconManager = UserIconManager.getInstance();
    const fallbackIcon = iconManager.getUserIcon({
      ...config,
      profilePictureUrl: undefined
    });
    setIconUrl(fallbackIcon);
  };

  return {
    iconUrl,
    isLoading,
    hasError,
    handleImageError
  };
};

export default UserIconManager;
