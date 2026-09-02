import axios from 'axios';
import type { Conversation, Message, AutoResponseRule } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased timeout for multi-platform operations
  headers: {
     'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with retry logic
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

apiClient.interceptors.response.use(
  (response) => {
    retryCount = 0; // Reset retry count on success
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle unauthorized access
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    
    // Retry logic for network errors or server errors
    if (retryCount < MAX_RETRIES && 
        (error.code === 'NETWORK_ERROR' || 
         error.response?.status >= 500 || 
         error.response?.status === 408)) {
      
      retryCount++;
      console.log(`🔄 Retrying request (${retryCount}/${MAX_RETRIES}):`, originalRequest.url);
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
      return apiClient(originalRequest);
    }
    
    return Promise.reject(error);
  }
);

class ApiService {
  // 获取所有对话
  static async getConversations(): Promise<Conversation[]> {
    try {
      const response = await apiClient.get('/conversations');
      // Handle different response formats
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (response.data && Array.isArray(response.data.conversations)) {
        return response.data.conversations;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      return [];
    }
  }

  // 获取单个对话详情
  static async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const response = await apiClient.get(`/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      throw error;
    }
  }

  // 获取对话消息历史 - Enhanced with pagination
  static async getConversationMessages(
    conversationId: string,
    params: { 
      limit?: number; 
      offset?: number; 
      order?: 'ASC' | 'DESC';
      platform?: string;
    } = {}
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    try {
      const response = await apiClient.get(`/conversations/${conversationId}/messages`, { params });
      
      // Handle enhanced response format with pagination
      if (response.data && response.data.success) {
        return {
          messages: response.data.messages || [],
          total: response.data.total || 0,
          hasMore: response.data.hasMore || false
        };
      }
      
      // Fallback for old format
      let messages: Message[] = [];
      if (Array.isArray(response.data)) {
        messages = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        messages = response.data.data;
      } else if (response.data && Array.isArray(response.data.messages)) {
        messages = response.data.messages;
      }
      
      return {
        messages,
        total: messages.length,
        hasMore: false
      };
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      return {
        messages: [],
        total: 0,
        hasMore: false
      };
    }
  }

  // 发送消息到任意平台 - FIXED
  static   async sendMessage(
    conversationId: string,
    messageData: {
      content: string;
      messageType?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker';
      mediaUrl?: string;
      mediaType?: string;
      platform?: string;
      replyTo?: string; // 回复消息ID
    }
  ): Promise<Message | null> {
    try {
      console.log('📤 API Service sending message:', messageData.content, 'to conversation:', conversationId);
      console.log('📤 API Service platform:', messageData.platform);
      
      // Choose the correct endpoint based on platform
      let endpoint = '/send-message-to-user'; // legacy fallback
      if (messageData.platform === 'whatsapp') {
        endpoint = '/send-whatsapp-message';
      } else if (messageData.platform === 'line') {
        endpoint = '/send-line-message';
      }
      
      console.log('📤 API Service using endpoint:', endpoint);
      
      const response = await apiClient.post(endpoint, {
        conversationId,
        message: messageData.content, // Backend expects 'message', not 'content'
        messageType: messageData.messageType || 'text',
        mediaUrl: messageData.mediaUrl,
        mediaType: messageData.mediaType,
        platform: messageData.platform,
        replyTo: messageData.replyTo
      });

      console.log('✅ API Service message sent successfully:', response.data);
      
      if (response.data && response.data.success) {
        return response.data.message;
      }
      return null;
    } catch (error: any) {
      console.error('❌ API Service failed to send message:', error);
      if (error.response) {
        console.error('   Response data:', error.response.data);
        console.error('   Response status:', error.response.status);
      }
      throw error;
    }
  }

  // 获取消息数量
  static async getConversationMessageCount(conversationId: string): Promise<number> {
    try {
      const response = await apiClient.get(`/conversations/${conversationId}/messages`);
      return response.data.total || response.data.messages?.length || 0;
    } catch (error) {
      console.error('Failed to get message count:', error);
      return 0;
    }
  }

  // 获取自动回复规则
  static async getAutoResponseRules(platform: string): Promise<AutoResponseRule[]> {
    try {
      const response = await apiClient.get(`/auto-response-rules/${platform}`);
      return response.data.rules || [];
    } catch (error) {
      console.error('Failed to fetch auto-response rules:', error);
      return [];
    }
  }

  // 创建自动回复规则
  static async createAutoResponseRule(rule: Omit<AutoResponseRule, 'id'>): Promise<AutoResponseRule> {
    try {
      const response = await apiClient.post('/auto-response-rules', rule);
      return response.data.rule;
    } catch (error) {
      console.error('Failed to create auto-response rule:', error);
      throw error;
    }
  }

  // 更新自动回复规则
  static async updateAutoResponseRule(ruleId: string, updates: Partial<AutoResponseRule>): Promise<AutoResponseRule> {
    try {
      const response = await apiClient.put(`/auto-response-rules/${ruleId}`, updates);
      return response.data.rule;
    } catch (error) {
      console.error('Failed to update auto-response rule:', error);
      throw error;
    }
  }

  // 删除自动回复规则
  static async deleteAutoResponseRule(ruleId: string): Promise<void> {
    try {
      await apiClient.delete(`/auto-response-rules/${ruleId}`);
    } catch (error) {
      console.error('Failed to delete auto-response rule:', error);
      throw error;
    }
  }

  // 获取自动回复模板
  static async getAutoResponseTemplates(platform: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`/auto-response-templates/${platform}`);
      return response.data.templates || [];
    } catch (error) {
      console.error('Failed to fetch auto-response templates:', error);
      return [];
    }
  }

  // 获取用户资料
  static async getProfile(userId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/profile/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }

  // 批量获取用户资料
  static async getBatchProfiles(userIds: string[]): Promise<any[]> {
    try {
      const response = await apiClient.post('/profiles/batch', { userIds });
      return response.data.profiles || [];
    } catch (error) {
      console.error('Failed to fetch batch profiles:', error);
      return [];
    }
  }

  // 获取资料服务状态
  static async getProfileServiceStatus(): Promise<any> {
    try {
      const response = await apiClient.get('/profiles/status');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch profile service status:', error);
      return null;
    }
  }

  // 健康检查
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await apiClient.get('/health');
      return response.data.success === true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // 获取平台统计
  static async getPlatformStats(): Promise<any> {
    try {
      const response = await apiClient.get('/stats/platforms');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch platform stats:', error);
      return null;
    }
  }

  // 获取用户统计
  static async getUserStats(): Promise<any> {
    try {
      const response = await apiClient.get('/stats/users');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      return null;
    }
  }

  // 获取消息统计
  static async getMessageStats(): Promise<any> {
    try {
      const response = await apiClient.get('/stats/messages');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch message stats:', error);
      return null;
    }
  }

  // 获取对话统计
  static async getConversationStats(): Promise<any> {
    try {
      const response = await apiClient.get('/stats/conversations');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch conversation stats:', error);
      return null;
    }
  }

  // 获取系统状态
  static async getSystemStatus(): Promise<any> {
    try {
      const response = await apiClient.get('/status');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      return null;
    }
  }

  // 获取平台配置
  static async getPlatformConfig(platform: string): Promise<any> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/config`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch platform config:', error);
      return null;
    }
  }

  // 更新平台配置
  static async updatePlatformConfig(platform: string, config: any): Promise<any> {
    try {
      const response = await apiClient.put(`/platforms/${platform}/config`, config);
      return response.data;
    } catch (error) {
      console.error('Failed to update platform config:', error);
      throw error;
    }
  }

  // 测试平台连接
  static async testPlatformConnection(platform: string): Promise<boolean> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/test`);
      return response.data.success === true;
    } catch (error) {
      console.error('Platform connection test failed:', error);
      return false;
    }
  }

  // 获取平台用户
  static async getPlatformUsers(platform: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/users`);
      return response.data.users || [];
    } catch (error) {
      console.error('Failed to fetch platform users:', error);
      return [];
    }
  }

  // 同步平台数据
  static async syncPlatformData(platform: string): Promise<any> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/sync`);
      return response.data;
    } catch (error) {
      console.error('Failed to sync platform data:', error);
      throw error;
    }
  }

  // 获取平台消息
  static async getPlatformMessages(platform: string, params?: any): Promise<any[]> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/messages`, { params });
      return response.data.messages || [];
    } catch (error) {
      console.error('Failed to fetch platform messages:', error);
      return [];
    }
  }

  // 发送平台消息
  static async sendPlatformMessage(platform: string, messageData: any): Promise<any> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/send`, messageData);
      return response.data;
    } catch (error) {
      console.error('Failed to send platform message:', error);
      throw error;
    }
  }

  // 获取平台事件
  static async getPlatformEvents(platform: string, params?: any): Promise<any[]> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/events`, { params });
      return response.data.events || [];
    } catch (error) {
      console.error('Failed to fetch platform events:', error);
      return [];
    }
  }

  // 处理平台事件
  static async handlePlatformEvent(platform: string, eventData: any): Promise<any> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/events`, eventData);
      return response.data;
    } catch (error) {
      console.error('Failed to handle platform event:', error);
      throw error;
    }
  }

  // 获取平台分析
  static async getPlatformAnalytics(platform: string, params?: any): Promise<any> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/analytics`, { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch platform analytics:', error);
      return null;
    }
  }

  // 获取平台报告
  static async getPlatformReport(platform: string, params?: any): Promise<any> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/report`, { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch platform report:', error);
      return null;
    }
  }

  // 导出平台数据
  static async exportPlatformData(platform: string, format: string = 'json'): Promise<any> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/export`, { 
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export platform data:', error);
      throw error;
    }
  }

  // 导入平台数据
  static async importPlatformData(platform: string, data: any): Promise<any> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/import`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to import platform data:', error);
      throw error;
    }
  }

  // 获取平台日志
  static async getPlatformLogs(platform: string, params?: any): Promise<any[]> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/logs`, { params });
      return response.data.logs || [];
    } catch (error) {
      console.error('Failed to fetch platform logs:', error);
      return [];
    }
  }

  // 清除平台日志
  static async clearPlatformLogs(platform: string): Promise<void> {
    try {
      await apiClient.delete(`/platforms/${platform}/logs`);
    } catch (error) {
      console.error('Failed to clear platform logs:', error);
      throw error;
    }
  }

  // 获取平台错误
  static async getPlatformErrors(platform: string, params?: any): Promise<any[]> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/errors`, { params });
      return response.data.errors || [];
    } catch (error) {
      console.error('Failed to fetch platform errors:', error);
      return [];
    }
  }

  // 清除平台错误
  static async clearPlatformErrors(platform: string): Promise<void> {
    try {
      await apiClient.delete(`/platforms/${platform}/errors`);
    } catch (error) {
      console.error('Failed to clear platform errors:', error);
      throw error;
    }
  }

  // 获取平台性能
  static async getPlatformPerformance(platform: string, params?: any): Promise<any> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/performance`, { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch platform performance:', error);
      return null;
    }
  }

  // 获取平台健康状态
  static async getPlatformHealth(platform: string): Promise<any> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/health`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch platform health:', error);
      return null;
    }
  }

  // 重启平台服务
  static async restartPlatformService(platform: string): Promise<any> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/restart`);
      return response.data;
    } catch (error) {
      console.error('Failed to restart platform service:', error);
      throw error;
    }
  }

  // 停止平台服务
  static async stopPlatformService(platform: string): Promise<any> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/stop`);
      return response.data;
    } catch (error) {
      console.error('Failed to stop platform service:', error);
      throw error;
    }
  }

  // 启动平台服务
  static async startPlatformService(platform: string): Promise<any> {
    try {
      const response = await apiClient.post(`/platforms/${platform}/start`);
      return response.data;
    } catch (error) {
      console.error('Failed to start platform service:', error);
      throw error;
    }
  }

  // 获取平台状态
  static async getPlatformStatus(platform: string): Promise<any> {
    try {
      const response = await apiClient.get(`/platforms/${platform}/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch platform status:', error);
      return null;
    }
  }

  // 更新平台状态
  static async updatePlatformStatus(platform: string, status: any): Promise<any> {
    try {
      const response = await apiClient.put(`/platforms/${platform}/status`, status);
      return response.data;
    } catch (error) {
      console.error('Failed to update platform status:', error);
      throw error;
    }
  }

  static async getAiStatus(): Promise<{
    enabled: boolean;
    autoReplyEnabled: boolean;
    provider: string;
    requestedProvider?: string;
    claudeConfigured?: boolean;
    model?: string;
    debounceMs?: number;
  }> {
    try {
      const response = await apiClient.get('/ai/status');
      return response.data?.data || { enabled: false, autoReplyEnabled: false, provider: 'stub' };
    } catch (error) {
      console.error('Failed to fetch AI status:', error);
      return { enabled: false, autoReplyEnabled: false, provider: 'stub' };
    }
  }

  static async getAiConversationSettings(conversationId: string): Promise<{ autoReplyEnabled: boolean }> {
    try {
      const response = await apiClient.get(`/ai/conversations/${conversationId}/settings`);
      return {
        autoReplyEnabled: response.data?.data?.autoReplyEnabled === true
      };
    } catch (error) {
      console.error('Failed to fetch AI conversation settings:', error);
      return { autoReplyEnabled: false };
    }
  }

  static async setAiConversationAutoReply(
    conversationId: string,
    autoReplyEnabled: boolean
  ): Promise<{ autoReplyEnabled: boolean }> {
    const response = await apiClient.patch(`/ai/conversations/${conversationId}/settings`, {
      autoReplyEnabled
    });
    return {
      autoReplyEnabled: response.data?.data?.autoReplyEnabled === true
    };
  }
}

export default ApiService;
