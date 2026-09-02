/**
 * Robust Socket.IO Service with Retry Mechanism
 * Handles connection reliability and automatic reconnection
 */

import { io, Socket } from 'socket.io-client';

interface SocketConfig {
  url: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
}

interface SocketEventHandlers {
  [eventName: string]: (...args: any[]) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private config: SocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private isConnecting = false;
  private eventHandlers: SocketEventHandlers = {};
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';

  constructor(config: SocketConfig) {
    this.config = {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      ...config
    };
    
    this.maxReconnectAttempts = this.config.reconnectionAttempts || 5;
    this.reconnectDelay = this.config.reconnectionDelay || 1000;
  }

  /**
   * Connect to Socket.IO server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || this.connectionStatus === 'connected') {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.connectionStatus = 'connecting';

      // Connecting to Socket.IO server

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(this.config.url, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: this.config.timeout,
        forceNew: true,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        extraHeaders: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      });

      // Connection success
      this.socket.on('connect', () => {
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.registerEventHandlers();
        
        // Request missed messages after reconnection
        this.socket?.emit('sync_missed_messages');
        
        resolve();
      });

      // Connection error
      this.socket.on('connect_error', (error) => {
        this.connectionStatus = 'disconnected';
        this.isConnecting = false;
        this.handleReconnection();
        reject(error);
      });

      // Disconnection
      this.socket.on('disconnect', (reason) => {
        this.connectionStatus = 'disconnected';
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect
        } else {
          // Client disconnect, attempt reconnection
          this.handleReconnection();
        }
      });

      // Reconnection events
      this.socket.on('reconnect', (attemptNumber) => {
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        
        // Re-register event handlers after reconnection
        this.registerEventHandlers();
        
        // Request missed messages after reconnection
        this.socket?.emit('sync_missed_messages');
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        this.connectionStatus = 'reconnecting';
      });

      this.socket.on('reconnect_error', (error) => {
        this.connectionStatus = 'disconnected';
      });

      this.socket.on('reconnect_failed', () => {
        this.connectionStatus = 'disconnected';
        this.reconnectAttempts = this.maxReconnectAttempts;
      });
    });
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ SocketService: Max reconnection attempts reached (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`🔄 SocketService: Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Register event handlers
   */
  private registerEventHandlers() {
    if (!this.socket) return;

    // Register all stored event handlers
    Object.entries(this.eventHandlers).forEach(([event, handler]) => {
      this.socket!.on(event, handler);
    });
  }

  /**
   * Add event listener
   */
  on(event: string, handler: (...args: any[]) => void) {
    this.eventHandlers[event] = handler;
    
    if (this.socket && this.socket.connected) {
      this.socket.on(event, handler);
    }
  }

  /**
   * Remove event listener
   */
  off(event: string, handler?: (...args: any[]) => void) {
    delete this.eventHandlers[event];
    
    if (this.socket) {
      if (handler) {
        this.socket.off(event, handler);
      } else {
        this.socket.off(event);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event: string, ...args: any[]) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, ...args);
    } else {
      console.warn(`⚠️ SocketService: Cannot emit '${event}' - socket not connected`);
    }
  }

  /**
   * Join a room/conversation
   */
  joinConversation(conversationId: string) {
    this.emit('join_conversation', conversationId);
  }

  /**
   * Leave a room/conversation
   */
  leaveConversation(conversationId: string) {
    this.emit('leave_conversation', conversationId);
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionStatus = 'disconnected';
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.eventHandlers = {};
  }

  /**
   * Force reconnection
   */
  async forceReconnect(): Promise<void> {
    console.log('🔄 SocketService: Force reconnecting...');
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    return this.connect();
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      status: this.connectionStatus,
      connected: this.socket?.connected || false,
      socketId: this.socket?.id || null,
      url: this.config.url,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }


  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SocketConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.reconnectionAttempts) {
      this.maxReconnectAttempts = newConfig.reconnectionAttempts;
    }
    
    if (newConfig.reconnectionDelay) {
      this.reconnectDelay = newConfig.reconnectionDelay;
    }
  }
}

// Create singleton instance
const socketService = new SocketService({
  url: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000',
  reconnectionAttempts: parseInt(import.meta.env.VITE_SOCKET_RECONNECTION_ATTEMPTS || '5'),
  reconnectionDelay: parseInt(import.meta.env.VITE_SOCKET_RECONNECTION_DELAY || '1000'),
  timeout: parseInt(import.meta.env.VITE_SOCKET_TIMEOUT || '20000')
});

export default socketService;
export { SocketService };
