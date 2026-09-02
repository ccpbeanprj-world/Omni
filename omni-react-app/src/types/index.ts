// Socket.IO event types
export interface ServerToClientEvents {
  new_message: (data: {
    conversationId: string;
    message: {
      id: string;
      content: string;
      type: string;
      sender_type: string;
      sender: {
        id: string;
        name: string;
        platform: string;
        profile_picture_url?: string;
      };
      timestamp: string;
      sender_name?: string;
      conversation_user_name?: string;
      sender_profile_picture_url?: string;
      conversation_user_profile_picture_url?: string;
      media_type?: string;
    };
  }) => void;
  message_sent: (data: {
    conversationId: string;
    messageId: string;
    status: string;
  }) => void;
  message_received: (data: {
    conversationId: string;
    message: {
      id: string;
      content: string;
      type: string;
      sender_id: string;
      sender_name: string;
      timestamp: string;
      created_at: string;
    };
    conversation: {
      id: string;
      user_name: string;
      profile_picture_url?: string;
    };
  }) => void;
  conversation_updated: (data: {
    conversationId: string;
    updatedAt: string;
  }) => void;
  user_typing: (data: {
    userId: string;
    userName: string;
    isTyping: boolean;
    timestamp: string;
  }) => void;
  message_read: (data: {
    messageId: string;
    userId: string;
    timestamp: string;
  }) => void;
  user_presence_update: (data: {
    userId: string;
    userName: string;
    status: string;
    timestamp: string;
  }) => void;
  conversation_status_updated: (data: {
    conversationId: string;
    status: string;
    agentId: string;
    agentName: string;
    timestamp: string;
  }) => void;
  file_upload_progress: (data: {
    fileId: string;
    progress: number;
    fileName: string;
  }) => void;
  file_upload_complete: (data: {
    fileId: string;
    fileUrl: string;
    fileName: string;
  }) => void;
  system_notification: (data: {
    type: string;
    message: string;
    timestamp: string;
  }) => void;
}

export interface ClientToServerEvents {
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;
  send_message: (data: {
    conversationId: string;
    content: string;
    type?: string;
    mediaUrl?: string;
    mediaType?: string;
  }) => void;
  test_connection: (data: { message: string }) => void;
  typing_start: (data: {
    userId: string;
    userName: string;
    conversationId: string;
  }) => void;
  typing_stop: (data: {
    userId: string;
    userName: string;
    conversationId: string;
  }) => void;
  mark_message_read: (data: {
    messageId: string;
    userId: string;
    conversationId: string;
  }) => void;
  user_presence: (data: {
    userId: string;
    userName: string;
    status: 'online' | 'offline' | 'away';
  }) => void;
  conversation_status_change: (data: {
    conversationId: string;
    status: string;
    agentId: string;
    agentName: string;
  }) => void;
}

// Message types
export interface Message {
  id: string;
  content: string;
  type: string;
  sender_type: 'user' | 'agent' | 'auto_response';
  sender?: {
    id: string;
    name: string;
    platform: string;
    profile_picture_url?: string;
  };
  sender_id?: string;
  sender_name?: string;
  platform?: string;
  profile_picture_url?: string;
  timestamp: string;
  created_at: string;
  status?: string;
  media_url?: string;
  conversation_user_name?: string;
  sender_profile_picture_url?: string;
  media_type?: string;
  conversation_user_profile_picture_url?: string;
  conversation_id?: string;
}

// Conversation types
export interface Conversation {
  id: string;
  platform: string;
  platform_conversation_id?: string;
  platform_user_id?: string;
  user_name?: string;
  profile_picture_url?: string;
  user_metadata?: any;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  status: string;
  unread_count?: number;
  message_count?: number;
  business_account_name?: string;
  sender_type?: string;
}

// User types
export interface User {
  id: string;
  name: string;
  platform: string;
  profile_picture_url?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

// Platform types
export type Platform = 'whatsapp' | 'facebook' | 'wechat' | 'instagram' | 'line' | 'threads';

// Emoji types
export interface EmojiData {
  emoji: string;
  name: string;
  shortNames: string[];
  tags: string[];
  unicodeVersion: string;
  tone?: string;
}

export interface EmojiClickData {
  emoji: string;
  unified: string;
  originalUnified: string;
}

export interface PlatformIcon {
  name: string;
  icon: string;
  color: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

// Chat component props
export interface ChatMessageProps {
  message: Message;
  showAvatar?: boolean;
}

export interface ChatConversationProps {
  conversation: Conversation;
  isActive?: boolean;
  onClick: (conversation: Conversation) => void;
}

export interface MessageInputProps {
  onSendMessage: (content: string, type?: string, mediaUrl?: string, mediaType?: string) => void;
  disabled?: boolean;
}

// Emoji types
export interface EmojiData {
  emoji: string;
  name: string;
  shortNames: string[];
  tags: string[];
  unicodeVersion: string;
  tone?: string;
}

// Audio recording types
export interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

// Auto-response rule types
export interface AutoResponseRule {
  id: string;
  platform: Platform;
  trigger_type: 'keyword' | 'time' | 'message_count';
  trigger_value: string;
  response_message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
