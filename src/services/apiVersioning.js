#!/usr/bin/env node

/**
 * API Versioning System
 * Comprehensive API versioning strategy
 */

const express = require('express');

class ApiVersioning {
  constructor() {
    this.versions = new Map();
    this.currentVersion = 'v1';
    this.deprecatedVersions = new Set();
    this.setupDefaultVersions();
  }

  /**
   * Setup default API versions
   */
  setupDefaultVersions() {
    // Version 1 (Current)
    this.addVersion('v1', {
      status: 'current',
      releaseDate: '2025-10-24',
      description: 'Initial API version with WhatsApp and LINE support',
      features: [
        'WhatsApp Business API integration',
        'LINE Bot API integration',
        'Real-time messaging',
        'User management',
        'Conversation management',
        'Message history',
        'Webhook handling'
      ],
      deprecationDate: null,
      sunsetDate: null
    });

    // Version 2 (Planned)
    this.addVersion('v2', {
      status: 'planned',
      releaseDate: '2025-12-01',
      description: 'Enhanced API with Facebook Messenger and WeChat support',
      features: [
        'Facebook Messenger integration',
        'WeChat integration',
        'Advanced analytics',
        'Message templates',
        'Automated responses',
        'Multi-language support',
        'Enhanced security'
      ],
      deprecationDate: null,
      sunsetDate: null
    });
  }

  /**
   * Add API version
   */
  addVersion(version, config) {
    this.versions.set(version, {
      ...config,
      version: version,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Get version information
   */
  getVersionInfo(version) {
    return this.versions.get(version);
  }

  /**
   * Get all versions
   */
  getAllVersions() {
    return Array.from(this.versions.values());
  }

  /**
   * Get current version
   */
  getCurrentVersion() {
    return this.currentVersion;
  }

  /**
   * Set current version
   */
  setCurrentVersion(version) {
    if (this.versions.has(version)) {
      this.currentVersion = version;
    } else {
      throw new Error(`Version ${version} does not exist`);
    }
  }

  /**
   * Mark version as deprecated
   */
  deprecateVersion(version, deprecationDate, sunsetDate) {
    if (this.versions.has(version)) {
      const versionInfo = this.versions.get(version);
      versionInfo.status = 'deprecated';
      versionInfo.deprecationDate = deprecationDate;
      versionInfo.sunsetDate = sunsetDate;
      
      this.deprecatedVersions.add(version);
    }
  }

  /**
   * Check if version is deprecated
   */
  isDeprecated(version) {
    return this.deprecatedVersions.has(version);
  }

  /**
   * Check if version is sunset
   */
  isSunset(version) {
    const versionInfo = this.versions.get(version);
    if (!versionInfo || !versionInfo.sunsetDate) {
      return false;
    }
    
    return new Date() > new Date(versionInfo.sunsetDate);
  }

  /**
   * Create versioned router
   */
  createVersionedRouter(version) {
    const router = express.Router();
    
    // Add version info to all requests
    router.use((req, res, next) => {
      req.apiVersion = version;
      req.versionInfo = this.getVersionInfo(version);
      
      // Add version headers
      res.set({
        'API-Version': version,
        'API-Status': req.versionInfo?.status || 'unknown',
        'API-Current-Version': this.currentVersion
      });
      
      // Add deprecation warning if applicable
      if (this.isDeprecated(version)) {
        res.set('API-Deprecation-Warning', `Version ${version} is deprecated`);
        res.set('API-Sunset-Date', req.versionInfo?.sunsetDate || 'TBD');
      }
      
      next();
    });
    
    return router;
  }

  /**
   * Version middleware
   */
  versionMiddleware() {
    return (req, res, next) => {
      // Extract version from URL path
      const versionMatch = req.path.match(/^\/api\/(v\d+)\//);
      let version = versionMatch ? versionMatch[1] : this.currentVersion;
      
      // FIXED: Don't redirect non-versioned URLs to avoid breaking existing routes
      // Only process versioned URLs
      if (!versionMatch) {
        // For non-versioned URLs, just add version info without redirecting
        req.apiVersion = this.currentVersion;
        req.versionInfo = this.getVersionInfo(this.currentVersion);
        next();
        return;
      }
      
      // Check if version exists
      if (!this.versions.has(version)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid API version',
          availableVersions: Array.from(this.versions.keys()),
          currentVersion: this.currentVersion,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if version is sunset
      if (this.isSunset(version)) {
        return res.status(410).json({
          success: false,
          error: 'API version has been sunset',
          sunsetDate: this.versions.get(version).sunsetDate,
          currentVersion: this.currentVersion,
          timestamp: new Date().toISOString()
        });
      }
      
      // Add version info to request
      req.apiVersion = version;
      req.versionInfo = this.getVersionInfo(version);
      
      // Add version headers
      res.set({
        'API-Version': version,
        'API-Status': req.versionInfo.status,
        'API-Current-Version': this.currentVersion
      });
      
      // Add deprecation warning if applicable
      if (this.isDeprecated(version)) {
        res.set('API-Deprecation-Warning', `Version ${version} is deprecated`);
        res.set('API-Sunset-Date', req.versionInfo.sunsetDate || 'TBD');
      }
      
      next();
    };
  }

  /**
   * Version info endpoint
   */
  versionInfoEndpoint() {
    return (req, res) => {
      const version = req.params.version || this.currentVersion;
      const versionInfo = this.getVersionInfo(version);
      
      if (!versionInfo) {
        return res.status(404).json({
          success: false,
          error: 'Version not found',
          availableVersions: Array.from(this.versions.keys())
        });
      }
      
      res.json({
        success: true,
        data: {
          version: versionInfo.version,
          status: versionInfo.status,
          description: versionInfo.description,
          features: versionInfo.features,
          releaseDate: versionInfo.releaseDate,
          deprecationDate: versionInfo.deprecationDate,
          sunsetDate: versionInfo.sunsetDate,
          isDeprecated: this.isDeprecated(version),
          isSunset: this.isSunset(version)
        }
      });
    };
  }

  /**
   * All versions endpoint
   */
  allVersionsEndpoint() {
    return (req, res) => {
      const allVersions = this.getAllVersions().map(version => ({
        version: version.version,
        status: version.status,
        description: version.description,
        releaseDate: version.releaseDate,
        deprecationDate: version.deprecationDate,
        sunsetDate: version.sunsetDate,
        isDeprecated: this.isDeprecated(version.version),
        isSunset: this.isSunset(version.version)
      }));
      
      res.json({
        success: true,
        data: {
          currentVersion: this.currentVersion,
          versions: allVersions
        }
      });
    };
  }

  /**
   * Migration guide endpoint
   */
  migrationGuideEndpoint() {
    return (req, res) => {
      const fromVersion = req.params.fromVersion;
      const toVersion = req.params.toVersion || this.currentVersion;
      
      const migrationGuide = this.generateMigrationGuide(fromVersion, toVersion);
      
      res.json({
        success: true,
        data: {
          fromVersion,
          toVersion,
          migrationGuide
        }
      });
    };
  }

  /**
   * Generate migration guide
   */
  generateMigrationGuide(fromVersion, toVersion) {
    const fromInfo = this.getVersionInfo(fromVersion);
    const toInfo = this.getVersionInfo(toVersion);
    
    if (!fromInfo || !toInfo) {
      return null;
    }
    
    const guide = {
      breakingChanges: [],
      newFeatures: [],
      deprecatedFeatures: [],
      migrationSteps: []
    };
    
    // Add breaking changes
    if (fromVersion === 'v1' && toVersion === 'v2') {
      guide.breakingChanges = [
        'Message format has changed - content field is now required',
        'Webhook signature verification is now mandatory',
        'Rate limiting has been updated'
      ];
      
      guide.newFeatures = [
        'Facebook Messenger integration',
        'WeChat integration',
        'Advanced analytics endpoints',
        'Message template support'
      ];
      
      guide.migrationSteps = [
        'Update your webhook signature verification',
        'Update message sending format',
        'Implement new error handling',
        'Test with new rate limits'
      ];
    }
    
    return guide;
  }

  /**
   * Setup versioned routes
   */
  setupVersionedRoutes(app) {
    // FIXED: Only apply version middleware to versioned routes, not all /api routes
    // This prevents breaking existing non-versioned routes
    
    // Version info endpoints (these are safe to version)
    app.get('/api/versions', this.allVersionsEndpoint());
    app.get('/api/versions/:version', this.versionInfoEndpoint());
    app.get('/api/migration/:fromVersion/:toVersion?', this.migrationGuideEndpoint());
    
    // Create versioned routers for future use
    for (const version of this.versions.keys()) {
      const router = this.createVersionedRouter(version);
      app.use(`/api/${version}`, router);
    }
    
    // Note: Version middleware is not applied globally to avoid breaking existing routes
    // Future versioned endpoints should be explicitly added under /api/v1/, /api/v2/, etc.
  }
}

module.exports = ApiVersioning;
