// omni-react-app/src/utils/dynamicUserUtils.ts
// import { getPlatformInfo } from './platformUtils'; // Unused for now

export interface DynamicUserData {
  displayName: string;
  profilePictureUrl: string;
  initials: string;
}

/**
 * Generate dynamic user data based on platform and user information
 */
export function generateDynamicUserData(
  platform: string,
  platformUserId: string,
  originalName?: string,
  originalProfileUrl?: string
): DynamicUserData {
  // const platformInfo = getPlatformInfo(platform); // Unused
  
  // Generate a dynamic display name based on platform and user ID
  const displayName = generateDynamicDisplayName(platform, platformUserId, originalName);
  
  // Generate a dynamic profile picture URL
  const profilePictureUrl = generateDynamicProfilePicture(platform, platformUserId, originalProfileUrl);
  
  // Generate initials
  const initials = generateInitials(displayName);
  
  return {
    displayName,
    profilePictureUrl,
    initials
  };
}

/**
 * Get enhanced user data for display - Use better avatar images
 */
export function getEnhancedUserData(conversation: any): DynamicUserData {
  // Use dynamic generation for all users - no hardcoded IDs
  return generateDynamicUserData(
    conversation.platform || 'line',
    conversation.platform_conversation_id || conversation.id,
    conversation.user_name,
    conversation.profile_picture_url
  );
}

/**
 * Get enhanced message sender data - Use better avatar images
 */
export function getEnhancedMessageSenderData(message: any, conversation: any): DynamicUserData {
  if (message.sender_type === 'agent') {
    return {
      displayName: 'Omni Project',
      profilePictureUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=OmniProject&backgroundColor=3B82F6&textColor=ffffff&size=200',
      initials: 'OP'
    };
  }
  
  // Use dynamic generation for all users - no hardcoded IDs
  return generateDynamicUserData(
    conversation?.platform || 'line',
    message.sender_id,
    message.sender_name,
    conversation?.profile_picture_url
  );
}

/**
 * Generate a dynamic display name
 */
function generateDynamicDisplayName(
  platform: string,
  platformUserId: string,
  originalName?: string
): string {
  // If we have a real name from the platform, use it
  if (originalName && originalName !== 'LINE User' && originalName !== 'Unknown User') {
    return originalName;
  }
  
  // Generate a dynamic name based on platform and user ID
  // Use only generic names to avoid hardcoded data
  const platformPrefixes = {
    line: 'LINE',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    wechat: 'WeChat',
    instagram: 'Instagram',
    threads: 'Threads'
  };
  
  const prefix = platformPrefixes[platform as keyof typeof platformPrefixes] || 'User';
  
  // Use user ID to generate a consistent identifier
  const hash = platformUserId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // Generate a short identifier from the hash
  const shortId = Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
  
  return `${prefix} User ${shortId}`;
}

/**
 * Generate a dynamic profile picture URL
 */
function generateDynamicProfilePicture(
  platform: string,
  platformUserId: string,
  originalProfileUrl?: string
): string {
  // PRIORITY: If we have a real profile picture URL, use it immediately
  if (originalProfileUrl && 
      originalProfileUrl.startsWith('http') && 
      !originalProfileUrl.includes('dicebear.com') &&
      !originalProfileUrl.includes('api.dicebear.com')) {
    console.log(`🖼️ Using real profile picture: ${originalProfileUrl}`);
    return originalProfileUrl;
  }
  
  // Fallback: Generate a consistent profile picture based on user ID
  console.log(`🎨 Generating fallback profile picture for ${platform} user ${platformUserId}`);
  
  const platformColors = {
    line: ['00C300', '00B8D4', '00A8CC'],
    whatsapp: ['25D366', '128C7E', '075E54'],
    facebook: ['1877F2', '42A5F5', '1E88E5'],
    wechat: ['07C160', '4CAF50', '388E3C'],
    instagram: ['E4405F', 'F06292', 'E91E63'],
    threads: ['000000', '424242', '616161']
  };
  
  const colors = platformColors[platform as keyof typeof platformColors] || ['6366F1'];
  
  // Use user ID to consistently pick the same color
  const hash = platformUserId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const selectedColor = colors[Math.abs(hash) % colors.length];
  
  // Generate initials for the profile picture (initials variable unused but calculation kept for potential future use)
  // const initials = generateInitials(generateDynamicDisplayName(platform, platformUserId)); // Unused
  
  return `https://api.dicebear.com/7.x/initials/svg?seed=${platformUserId}&backgroundColor=${selectedColor}&textColor=ffffff&size=150`;
}

/**
 * Generate initials from a name
 */
function generateInitials(name: string): string {
  if (!name) return 'U';
  
  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  
  return name.charAt(0).toUpperCase();
}
