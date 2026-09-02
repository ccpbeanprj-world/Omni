const BaseAdapter = require('./BaseAdapter');
const crypto = require('crypto');
const xml2js = require('xml2js');
const logger = require('../utils/logger');

class WeChatAdapter extends BaseAdapter {
  constructor(config) {
    super('wechat', {
      ...config,
      baseURL: 'https://api.weixin.qq.com'
    });
    
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.token = config.token;
    this.encodingAESKey = config.encodingAESKey;
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  async getAccessToken() {
    try {
      // Check if we have a valid access token
      if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }

      const response = await this.makeRequest('GET', '/cgi-bin/token', {
        grant_type: 'client_credential',
        appid: this.appId,
        secret: this.appSecret
      });

      this.accessToken = response.access_token;
      this.tokenExpiresAt = Date.now() + (response.expires_in - 300) * 1000; // 5 minutes buffer

      logger.info('WeChat access token refreshed');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get WeChat access token', error);
      throw error;
    }
  }

  async sendMessage(conversationId, message) {
    try {
      const accessToken = await this.getAccessToken();
      
      const payload = {
        touser: conversationId,
        msgtype: 'text',
        text: {
          content: message.text
        }
      };

      const response = await this.makeRequest('POST', `/cgi-bin/message/custom/send?access_token=${accessToken}`, payload);
      
      if (response.errcode === 0) {
        logger.info('WeChat message sent', {
          conversationId,
          messageId: response.msgid
        });

        return {
          success: true,
          messageId: response.msgid,
          platform: 'wechat'
        };
      } else {
        throw new Error(`WeChat API error: ${response.errmsg}`);
      }
    } catch (error) {
      logger.error('Failed to send WeChat message', error);
      throw error;
    }
  }

  async sendMedia(conversationId, mediaUrl, mediaType, caption = '') {
    try {
      const accessToken = await this.getAccessToken();
      
      let payload;
      let msgType;

      switch (mediaType) {
        case 'image':
          msgType = 'image';
          payload = {
            touser: conversationId,
            msgtype: 'image',
            image: {
              media_id: mediaUrl // In WeChat, mediaUrl should be media_id
            }
          };
          break;
        case 'voice':
          msgType = 'voice';
          payload = {
            touser: conversationId,
            msgtype: 'voice',
            voice: {
              media_id: mediaUrl
            }
          };
          break;
        case 'video':
          msgType = 'video';
          payload = {
            touser: conversationId,
            msgtype: 'video',
            video: {
              media_id: mediaUrl,
              title: caption,
              description: caption
            }
          };
          break;
        case 'music':
          msgType = 'music';
          payload = {
            touser: conversationId,
            msgtype: 'music',
            music: {
              title: caption,
              description: caption,
              musicurl: mediaUrl,
              hqmusicurl: mediaUrl
            }
          };
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      const response = await this.makeRequest('POST', `/cgi-bin/message/custom/send?access_token=${accessToken}`, payload);
      
      if (response.errcode === 0) {
        logger.info('WeChat media sent', {
          conversationId,
          mediaType,
          messageId: response.msgid
        });

        return {
          success: true,
          messageId: response.msgid,
          platform: 'wechat'
        };
      } else {
        throw new Error(`WeChat API error: ${response.errmsg}`);
      }
    } catch (error) {
      logger.error('Failed to send WeChat media', error);
      throw error;
    }
  }

  async markAsRead(conversationId, messageId) {
    // WeChat doesn't have a direct read receipt API
    // This is a placeholder for consistency
    logger.info('WeChat read receipt not supported', {
      conversationId,
      messageId
    });

    return { success: true };
  }

  async getProfile(openId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await this.makeRequest('GET', `/cgi-bin/user/info`, {
        access_token: accessToken,
        openid: openId,
        lang: 'zh_CN'
      });

      return {
        id: openId,
        name: response.nickname,
        profile_picture_url: response.headimgurl,
        platform: 'wechat'
      };
    } catch (error) {
      logger.error('Failed to get WeChat profile', error);
      throw error;
    }
  }

  async validateWebhook(payload, signature) {
    // WeChat webhook validation
    const { signature: sig, timestamp, nonce } = payload.query;
    const token = this.token;
    
    const tmpArr = [token, timestamp, nonce].sort();
    const tmpStr = tmpArr.join('');
    const hashCode = crypto.createHash('sha1').update(tmpStr).digest('hex');
    
    return hashCode === sig;
  }

  async processWebhook(payload) {
    try {
      const { body } = payload;
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(body);
      const xml = result.xml;

      const messages = [];

      if (xml.MsgType) {
        const processedMessage = {
          id: xml.MsgId,
          from: xml.FromUserName,
          to: xml.ToUserName,
          timestamp: xml.CreateTime,
          type: xml.MsgType,
          text: xml.Content || '',
          media: this.extractMedia(xml),
          platform: 'wechat',
          conversationId: xml.FromUserName
        };

        messages.push(processedMessage);
      }

      logger.info('WeChat webhook processed', {
        messageCount: messages.length,
        messageType: xml.MsgType
      });

      return messages;
    } catch (error) {
      logger.error('Failed to process WeChat webhook', error);
      throw error;
    }
  }

  extractMedia(xml) {
    const media = {};
    
    switch (xml.MsgType) {
      case 'image':
        media.image = {
          mediaId: xml.MediaId,
          picUrl: xml.PicUrl
        };
        break;
      case 'voice':
        media.voice = {
          mediaId: xml.MediaId,
          format: xml.Format,
          recognition: xml.Recognition
        };
        break;
      case 'video':
        media.video = {
          mediaId: xml.MediaId,
          thumbMediaId: xml.ThumbMediaId
        };
        break;
      case 'location':
        media.location = {
          locationX: xml.Location_X,
          locationY: xml.Location_Y,
          scale: xml.Scale,
          label: xml.Label
        };
        break;
      case 'link':
        media.link = {
          title: xml.Title,
          description: xml.Description,
          url: xml.Url
        };
        break;
    }

    return media;
  }

  // WeChat specific methods
  async uploadMedia(filePath, mediaType) {
    try {
      const accessToken = await this.getAccessToken();
      const formData = new FormData();
      
      // This would need to be implemented with actual file upload
      // For now, returning a placeholder
      logger.info('WeChat media upload', {
        filePath,
        mediaType
      });

      return {
        success: true,
        mediaId: `wechat_media_${Date.now()}`,
        platform: 'wechat'
      };
    } catch (error) {
      logger.error('Failed to upload WeChat media', error);
      throw error;
    }
  }

  async sendNews(conversationId, articles) {
    try {
      const accessToken = await this.getAccessToken();
      
      const payload = {
        touser: conversationId,
        msgtype: 'news',
        news: {
          articles: articles.map(article => ({
            title: article.title,
            description: article.description,
            url: article.url,
            picurl: article.picurl
          }))
        }
      };

      const response = await this.makeRequest('POST', `/cgi-bin/message/custom/send?access_token=${accessToken}`, payload);
      
      if (response.errcode === 0) {
        logger.info('WeChat news sent', {
          conversationId,
          messageId: response.msgid
        });

        return {
          success: true,
          messageId: response.msgid,
          platform: 'wechat'
        };
      } else {
        throw new Error(`WeChat API error: ${response.errmsg}`);
      }
    } catch (error) {
      logger.error('Failed to send WeChat news', error);
      throw error;
    }
  }
}

module.exports = WeChatAdapter;







