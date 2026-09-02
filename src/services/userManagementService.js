// Dynamic user creation service for unknown real user IDs
class DynamicUserService {
  constructor() {
    this.userCache = new Map();
    this.userCounter = 1;
  }

  // Generate dynamic user data for unknown users
  generateDynamicUserData(userId, platform = 'line') {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId);
    }

    const userData = {
      id: userId,
      platform: platform,
      user_name: this.generateDynamicName(userId),
      profile_picture_url: this.generateDynamicProfilePicture(userId),
      status_message: '',
      online_status: 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.userCache.set(userId, userData);
    return userData;
  }

  // Generate dynamic name based on user ID
  generateDynamicName(userId) {
    const prefixes = ['User', 'Customer', 'Client', 'Guest'];
    const suffixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot'];
    
    const prefix = prefixes[this.userCounter % prefixes.length];
    const suffix = suffixes[this.userCounter % suffixes.length];
    const number = this.userCounter;
    
    this.userCounter++;
    return `${prefix} ${suffix} ${number}`;
  }

  // Generate dynamic profile picture
  generateDynamicProfilePicture(userId) {
    const colors = ['00C300', 'FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', '98D8C8'];
    const color = colors[this.userCounter % colors.length];
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}&backgroundColor=${color}&textColor=ffffff&size=150`;
  }

  // Get cached user data
  getCachedUser(userId) {
    return this.userCache.get(userId);
  }

  // Update user data
  updateUserData(userId, updates) {
    const existing = this.userCache.get(userId);
    if (existing) {
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      this.userCache.set(userId, updated);
      return updated;
    }
    return null;
  }

  // Clear cache
  clearCache() {
    this.userCache.clear();
    this.userCounter = 1;
  }
}

module.exports = DynamicUserService;
