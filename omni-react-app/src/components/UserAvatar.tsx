import React from 'react';

interface UserAvatarProps {
  userId: string;
  userName: string;
  platform?: string;
  profilePictureUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showPlatformIcon?: boolean;
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  userName,
  platform = 'line',
  profilePictureUrl,
  size = 'md',
  showPlatformIcon = false,
  className = ''
}) => {
  const [imageError, setImageError] = React.useState(false);
  
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  };

  const platformColors = {
    line: 'bg-green-500',
    whatsapp: 'bg-green-600',
    telegram: 'bg-blue-500',
    facebook: 'bg-blue-600',
    instagram: 'bg-pink-500',
    twitter: 'bg-blue-400',
    discord: 'bg-indigo-500',
    slack: 'bg-purple-500',
    teams: 'bg-blue-700',
    omni: 'bg-gray-600'
  };

  // Get initials from userName - handle all cases robustly
  const getInitials = (name: string | undefined | null): string => {
    // If name is null, undefined, or empty, return default
    if (!name || typeof name !== 'string' || name.trim() === '') return 'U';
    
    // Clean and filter out special characters, keep only letters and spaces
    const cleanName = name.trim().replace(/[^A-Za-z\s]/g, '').trim();
    
    // If after cleaning it's empty, return default
    if (!cleanName || cleanName === '') return 'U';
    
    // Split into words and filter out empty strings
    const words = cleanName.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) return 'U';
    
    if (words.length === 1) {
      // Single word - take first 2 letters (e.g., "Test" -> "TE", "Pk" -> "PK")
      const word = words[0];
      if (word.length >= 2) {
        return word.substring(0, 2).toUpperCase();
      } else {
        return (word + word).substring(0, 2).toUpperCase(); // "A" -> "AA"
      }
    } else {
      // Multiple words - take first letter of first two words (e.g., "Bean Chan" -> "BC")
      const initials = words.slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
      return initials.length > 0 ? initials : 'U';
    }
  };

  // Determine if we should show profile picture or initials
  // Skip problematic LINE CDN URLs and proxy endpoints to avoid 404 errors
  const shouldShowProfilePicture = profilePictureUrl && 
                                   !profilePictureUrl.includes('profile.line-scdn.net') && 
                                   !profilePictureUrl.includes('/api/proxy') &&
                                   profilePictureUrl.startsWith('http') &&
                                   !imageError;

  const initials = getInitials(userName);
  const platformColor = platformColors[platform as keyof typeof platformColors] || 'bg-gray-500';

  return (
    <div className={`relative ${className}`}>
      {/* Show profile picture only if valid and not problematic */}
      {shouldShowProfilePicture && !imageError ? (
        <img
          src={profilePictureUrl || ''}
          alt={userName || 'User'}
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-white shadow-md`}
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        /* Always show initials when no valid picture or image error */
        <div
          className={`${sizeClasses[size]} ${platformColor} rounded-full flex items-center justify-center text-white font-semibold border-2 border-white shadow-md`}
        >
          {initials}
        </div>
      )}

      {/* Platform Icon Badge */}
      {showPlatformIcon && (
        <div className="absolute -bottom-1 -right-1">
          <div className={`w-4 h-4 ${platformColor} rounded-full flex items-center justify-center border-2 border-white shadow-sm`}>
            <span className="text-xs text-white font-bold">
              {platform.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
