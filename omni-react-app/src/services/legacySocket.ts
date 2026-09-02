import { io, Socket } from 'socket.io-client';

// Define event types for better type safety
interface ServerToClientEvents {
  new_message: (data: any) => void;
  message_received: (data: any) => void;
  message_sent: (data: any) => void;
  user_typing: (data: any) => void;
  message_read: (data: any) => void;
  conversation_updated: (data: any) => void;
  conversation_created: (data: any) => void;
  test_connection_response: (data: any) => void;
}

interface ClientToServerEvents {
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;
  mark_message_read: (conversationId: string, messageId: string, userId: string) => void;
  test_connection: (data: any) => void;
  user_typing: (data: any) => void;
}

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private url: string;

  constructor() {
    this.url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
  }

  connect(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    // If socket exists and is connected, return it
    if (this.socket && this.socket.connected) {
      console.log('✅ Socket already connected:', this.socket.id);
      return this.socket;
    }
    
    // If socket exists but not connected, clean it up first
    if (this.socket && !this.socket.connected) {
      console.log('🧹 Cleaning up disconnected socket');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    
    console.log('🔌 Connecting to Socket.IO at:', this.url);
    
    this.socket = io(this.url, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      upgrade: true,
      forceNew: false
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected successfully:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_conversation', conversationId);
    }
  }

  leaveConversation(conversationId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_conversation', conversationId);
    }
  }

  markMessageRead(conversationId: string, messageId: string, userId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('mark_message_read', conversationId, messageId, userId);
    }
  }

  // Simple event listeners without retry logic
  onNewMessage(callback: (data: any) => void): void {
    if (this.socket && this.socket.connected) {
      console.log('🔌 Setting up new_message listener');
      this.socket.on('new_message', (data) => {
        console.log('📨 Socket.IO new_message event received:', data);
        callback(data);
      });
    } else {
      console.log('⚠️ Socket not connected, cannot set up new_message listener');
    }
  }

  onMessageReceived(callback: (data: any) => void): void {
    if (this.socket && this.socket.connected) {
      console.log('🔌 Setting up message_received listener');
      this.socket.on('message_received', (data) => {
        console.log('📥 Socket.IO message_received event received:', data);
        callback(data);
      });
    } else {
      console.log('⚠️ Socket not connected, cannot set up message_received listener');
    }
  }

  onMessageSent(callback: (data: any) => void): void {
    if (this.socket && this.socket.connected) {
      console.log('🔌 Setting up message_sent listener');
      this.socket.on('message_sent', (data) => {
        console.log('📤 Socket.IO message_sent event received:', data);
        callback(data);
      });
    } else {
      console.log('⚠️ Socket not connected, cannot set up message_sent listener');
    }
  }

  onConversationUpdated(callback: (data: any) => void): void {
    if (this.socket && this.socket.connected) {
      this.socket.on('conversation_updated', callback);
    }
  }

  onConversationCreated(callback: (data: any) => void): void {
    if (this.socket && this.socket.connected) {
      this.socket.on('conversation_created', callback);
    }
  }

  onUserTyping(callback: (data: any) => void): void {
    if (this.socket && this.socket.connected) {
      this.socket.on('user_typing', callback);
    }
  }

  onMessageRead(callback: (data: any) => void): void {
    if (this.socket && this.socket.connected) {
      this.socket.on('message_read', callback);
    }
  }

  // Additional methods used by chatStore
  isAvailable(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  startTyping(conversationId: string, userId: string, userName: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('user_typing', { conversationId, userId, userName, isTyping: true });
    }
  }

  stopTyping(conversationId: string, userId: string, userName: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('user_typing', { conversationId, userId, userName, isTyping: false });
    }
  }
}

export default new SocketService();