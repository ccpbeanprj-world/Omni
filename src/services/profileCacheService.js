/**
 * Profile Picture Caching Service
 * Reduces API calls by caching profile pictures with TTL
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

class ProfileCacheService {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
    this.maxCacheSize = 1000; // Maximum number of cached profiles
    this.cacheFile = path.join(__dirname, '../cache/profile-cache.json');
    this.isInitialized = false;

    this.loadCacheFromFile();
    this.startCleanupInterval();
  }

  async getUserProfile(platform, userId, fetchFunction) {
    this.stats.totalRequests++;
    const cacheKey = this.generateCacheKey(platform, userId);
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      this.stats.hits++;
      console.log(`📷 CACHE HIT: Profile for ${platform} user ${userId.substring(0, 8)}...`);
      return cached.data;
    }

    this.stats.misses++;
    console.log(`📷 CACHE MISS: Fetching profile for ${platform} user ${userId.substring(0, 8)}...`);

    try {
      const profileData = await fetchFunction();
      const profile = {
        data: profileData,
        timestamp: Date.now(),
        ttl: this.defaultTTL,
        platform: platform,
        userId: userId
      };

      this.setCache(cacheKey, profile);
      console.log(`📷 CACHE STORE: Profile cached for ${platform} user ${userId.substring(0, 8)}...`);
      return profileData;
    } catch (error) {
      console.error(`❌ CACHE ERROR: Failed to fetch profile for ${platform} user ${userId}:`, error.message);
      
      // Return expired cache if available
      if (cached) {
        console.log(`📷 CACHE FALLBACK: Using expired cache for ${platform} user ${userId.substring(0, 8)}...`);
        return cached.data;
      }
      
      // Return default profile
      return this.getDefaultProfile(platform, userId);
    }
  }

  async getLineUserProfile(userId, accessToken) {
    return this.getUserProfile('line', userId, async () => {
      try {
        const response = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          timeout: 5000
        });

        // Return LINE profile data - let backend handle proxy conversion
        return {
          displayName: response.data.displayName,
          pictureUrl: response.data.pictureUrl || null,
          statusMessage: response.data.statusMessage || ''
        };
      } catch (error) {
        console.error(`❌ LINE profile fetch failed for ${userId}:`, error.message);
        throw error;
      }
    });
  }

  async getWhatsAppUserProfile(phoneNumber, accessToken) {
    return this.getUserProfile('whatsapp', phoneNumber, async () => {
      const response = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumber}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 5000
      });

      return {
        displayName: response.data.name || `WhatsApp User ${phoneNumber}`,
        pictureUrl: response.data.profile_picture || null,
        statusMessage: response.data.status || ''
      };
    });
  }

  async getFacebookUserProfile(userId, accessToken) {
    return this.getUserProfile('facebook', userId, async () => {
      const response = await axios.get(`https://graph.facebook.com/v18.0/${userId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 5000
      });

      return {
        displayName: response.data.name || `Facebook User ${userId}`,
        pictureUrl: response.data.picture?.data?.url || null,
        statusMessage: response.data.status || ''
      };
    });
  }

  setCache(key, profile) {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntry();
    }

    this.cache.set(key, profile);
    this.saveCacheToFile();
  }

  isCacheValid(cached) {
    const now = Date.now();
    return (now - cached.timestamp) < cached.ttl;
  }

  generateCacheKey(platform, userId) {
    return `${platform}:${userId}`;
  }

  getDefaultProfile(platform, userId) {
    const platformNames = {
      line: 'LINE',
      whatsapp: 'WhatsApp',
      facebook: 'Facebook',
      telegram: 'Telegram'
    };

    return {
      displayName: `${platformNames[platform] || 'User'} User ${userId.substring(0, 8)}`,
      pictureUrl: null,
      statusMessage: ''
    };
  }

  evictOldestEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, profile] of this.cache.entries()) {
      if (profile.timestamp < oldestTime) {
        oldestTime = profile.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      console.log(`📷 CACHE EVICT: Removed oldest entry: ${oldestKey}`);
    }
  }

  loadCacheFromFile() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        const parsed = JSON.parse(data);
        
        this.cache = new Map(Object.entries(parsed.cache || {}));
        this.stats = { ...this.stats, ...parsed.stats };
        
        console.log(`📷 CACHE LOAD: Loaded ${this.cache.size} cached profiles`);
      }
    } catch (error) {
      console.error('❌ CACHE LOAD ERROR:', error.message);
    }
  }

  saveCacheToFile() {
    try {
      const cacheDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const data = {
        cache: Object.fromEntries(this.cache),
        stats: this.stats,
        timestamp: Date.now()
      };

      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ CACHE SAVE ERROR:', error.message);
    }
  }

  startCleanupInterval() {
    // Clean up expired entries every hour
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 60 * 1000);
  }

  cleanupExpiredEntries() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, profile] of this.cache.entries()) {
      if (!this.isCacheValid(profile)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`📷 CACHE CLEANUP: Removed ${cleanedCount} expired entries`);
      this.saveCacheToFile();
    }
  }

  getStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.cache.size
    };
  }

  clearCache() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    this.saveCacheToFile();
    console.log('📷 CACHE CLEAR: All cached profiles removed');
  }

  updateCacheTTL(platform, userId, newTTL) {
    const cacheKey = this.generateCacheKey(platform, userId);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      cached.ttl = newTTL;
      this.cache.set(cacheKey, cached);
      this.saveCacheToFile();
      console.log(`📷 CACHE TTL UPDATE: Updated TTL for ${platform} user ${userId.substring(0, 8)}... to ${newTTL}ms`);
    }
  }

  async preloadProfiles(users) {
    console.log(`📷 CACHE PRELOAD: Starting preload for ${users.length} users`);
    
    const preloadPromises = users.map(async (user) => {
      try {
        let fetchFunction;
        
        switch (user.platform) {
          case 'line':
            fetchFunction = () => this.getLineUserProfile(user.userId, user.accessToken);
            break;
          case 'whatsapp':
            fetchFunction = () => this.getWhatsAppUserProfile(user.userId, user.accessToken);
            break;
          case 'facebook':
            fetchFunction = () => this.getFacebookUserProfile(user.userId, user.accessToken);
            break;
          default:
            console.warn(`⚠️ CACHE PRELOAD: Unsupported platform: ${user.platform}`);
            return;
        }
        
        await this.getUserProfile(user.platform, user.userId, fetchFunction);
      } catch (error) {
        console.error(`❌ CACHE PRELOAD ERROR: Failed to preload ${user.platform} user ${user.userId}:`, error.message);
      }
    });
    
    await Promise.all(preloadPromises);
    console.log(`📷 CACHE PRELOAD: Completed preload for ${users.length} users`);
  }
}

module.exports = new ProfileCacheService();