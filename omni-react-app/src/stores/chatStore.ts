import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Conversation, Message } from '../types';
import ApiService from '../services/api';
import socketService from '../services/socketService';

interface ChatState {
  // Conversations
  conversations: Conversation[];
  currentConversation: Conversation | null;
  selectedConversationId: string | null;
  isLoadingConversations: boolean;
  conversationError: string | null;
  lastConversationLoad: number | null;
  lastUpdate: string;
  
  // Messages
  messages: Message[];
  isLoadingMessages: boolean;
  messageError: string | null;
  hasMoreMessages: boolean;
  totalMessageCount: number;
  lastMessageLoad: number | null;
  isSendingMessage: boolean;
  
  // Users
  currentlyTyping: Set<string>;
  userPresence: Map<string, { status: string; timestamp: string; userName?: string }>;
  
  // UI State
  sidebarOpen: boolean;
  searchQuery: string;
  showEmojiPicker: boolean;
  showAudioRecorder: boolean;
  
  // Real-time features
  isTyping: boolean;
  typingTimeout: NodeJS.Timeout | null;
  socketConnected: boolean;
  socketStatusInterval: NodeJS.Timeout | null;
  
  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversation: Conversation) => void;
  deleteConversation: (conversationId: string) => void;
  
  setMessages: (messages: Message[]) => void;
  prependMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  
  setTyping: (userId: string, isTyping: boolean) => void;
  setUserPresence: (userId: string, presence: { status: string; timestamp: string; userName?: string }) => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setShowEmojiPicker: (show: boolean) => void; 
  setShowAudioRecorder: (show: boolean) => void;
  
  // Real-time actions
  startTyping: () => void;
  stopTyping: () => void;
  markMessageAsRead: (messageId: string) => void;
  
  // Async Actions
  loadConversations: () => Promise<void>;
  fetchConversations: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  loadMessages: (conversationId: string, refresh?: boolean) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  loadMessageCount: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, type?: string, mediaUrl?: string, mediaType?: string, conversationId?: string) => Promise<void>;
  lastMessageSent: string;
  lastMessageTime: number;
  currentMessageId: string;
  pendingMessages: Set<string>; // Track pending message IDs
  sendAutoResponse: (message: string, platform?: string) => Promise<void>;
  getAutoResponseTemplates: (platform: string) => Promise<any[]>;
  
  // Dynamic Actions
  forceReloadConversations: () => Promise<void>;
  clearCache: () => void;
  initializeSocketIO: () => void;
  cleanupPolling: () => void;
  refreshConversations: () => Promise<void>;
  
  // Reset
  reset: () => void;
}

const initialState = {
  conversations: [],
  currentConversation: null,
  selectedConversationId: null,
  isLoadingConversations: false,
  conversationError: null,
  lastConversationLoad: null,
  lastUpdate: new Date().toISOString(),
  messages: [],
  isLoadingMessages: false,
  messageError: null,
  hasMoreMessages: false,
  totalMessageCount: 0,
  lastMessageLoad: null,
  isSendingMessage: false,
  currentlyTyping: new Set<string>(),
  userPresence: new Map<string, { status: string; timestamp: string; userName?: string }>(),
  sidebarOpen: true,
  searchQuery: '',
  showEmojiPicker: false,
  showAudioRecorder: false,
  isTyping: false,
  typingTimeout: null,
  lastMessageSent: '',
  lastMessageTime: 0,
  currentMessageId: '',
  pendingMessages: new Set<string>(),
  socketConnected: false,
  socketStatusInterval: null,
};

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Conversation actions
        setConversations: (conversations) => set({ conversations }),
        
        setCurrentConversation: (conversation) => {
          set({ currentConversation: conversation });
          
          // Join/leave socket rooms when conversation changes
          const previousConversation = get().conversations.find(conv => 
            conv.id === get().currentConversation?.id
          );
          
          if (previousConversation) {
            socketService.leaveConversation(previousConversation.id);
          }
          
          if (conversation) {
            socketService.joinConversation(conversation.id);
          }
        },
        
        addConversation: (conversation) => set((state) => ({
          conversations: [conversation, ...state.conversations.filter(c => c.id !== conversation.id)]
        })),
        
        updateConversation: (conversation) => set((state) => {
          return {
            conversations: state.conversations.map(c => 
              c.id === conversation.id ? { ...c, ...conversation } : c
            ),
            currentConversation: state.currentConversation?.id === conversation.id 
              ? { ...state.currentConversation, ...conversation }
              : state.currentConversation
          };
        }),
        
        deleteConversation: (conversationId) => set((state) => ({
          conversations: state.conversations.filter(c => c.id !== conversationId),
          currentConversation: state.currentConversation?.id === conversationId 
            ? null 
            : state.currentConversation
        })),
        
        // Message actions
        setMessages: (messages) => set({ messages }),
        
        prependMessages: (messages) => set((state) => ({
          messages: [...messages, ...state.messages]
        })),
        
        addMessage: (message) => set((state) => {
          // ULTRA ENHANCED DUPLICATE PREVENTION: Check multiple criteria with stricter rules
          const messageExists = state.messages.some(m => 
            m.id === message.id || 
            (m.content === message.content && 
             m.sender_type === message.sender_type && 
             m.conversation_id === message.conversation_id &&
             Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 10000) || // Extended to 10 seconds
            (m.content === message.content && 
             m.sender_type === message.sender_type && 
             m.conversation_id === message.conversation_id &&
             m.sender_id === message.sender_id) // Also check sender_id
          );
          
          if (messageExists) {
            // Duplicate message prevented
            return state;
          }
          
          // ENHANCED PROFILE PICTURE FIX: Always use conversation's profile picture for user messages
          let enhancedMessage = message;
          if (message.sender_type === 'user') {
            // Find the conversation for this message
            const messageConversation = state.conversations.find(conv => conv.id === message.conversation_id);
            
            enhancedMessage = {
              ...message,
              sender: {
                id: message.sender?.id || message.sender_id || 'user',
                name: messageConversation?.user_name || message.sender?.name || message.sender_name || 'User',
                platform: message.sender?.platform || message.platform || 'line',
                profile_picture_url: messageConversation?.profile_picture_url || message.sender?.profile_picture_url || undefined
              },
              sender_name: messageConversation?.user_name || message.sender_name || 'User'
            };
          }
          
          // Ensure message has proper timestamp and structure
          const messageWithTimestamp = {
            ...enhancedMessage,
            timestamp: enhancedMessage.timestamp || enhancedMessage.created_at || new Date().toISOString(),
            created_at: enhancedMessage.created_at || enhancedMessage.timestamp || new Date().toISOString(),
            // Ensure proper sender structure for real users
            sender: enhancedMessage.sender || {
              id: enhancedMessage.sender_id || 'user',
              name: enhancedMessage.sender_name || 'User',
              platform: enhancedMessage.platform || 'line',
              profile_picture_url: enhancedMessage.profile_picture_url
            }
          };
          
          // Add new message and sort to maintain chronological order
          const allMessages = [...state.messages, messageWithTimestamp];
          const sortedMessages = allMessages.sort((a, b) => 
            new Date(a.timestamp || a.created_at).getTime() - new Date(b.timestamp || b.created_at).getTime()
          );
          
          // Update conversation with latest message info
          const updatedConversations = state.conversations.map(conv => {
            if (conv.id === messageWithTimestamp.conversation_id) {
              const updatedConv = {
                ...conv,
                last_message: messageWithTimestamp.content || '',
                last_message_at: messageWithTimestamp.timestamp || new Date().toISOString(),
                message_count: (conv.message_count || 0) + 1,
                updated_at: new Date().toISOString()
              };
              
              // Update user info if this is a real user message
              if (messageWithTimestamp.sender_type === 'user' && messageWithTimestamp.sender) {
                updatedConv.user_name = messageWithTimestamp.sender.name;
                updatedConv.profile_picture_url = messageWithTimestamp.sender.profile_picture_url;
              }
              
              return updatedConv;
            }
            return conv;
          });
          
          // Auto-mark user messages as read when added in real-time
          if (messageWithTimestamp.sender_type === 'user' && messageWithTimestamp.status !== 'read') {
            setTimeout(() => {
              get().markMessageAsRead(messageWithTimestamp.id);
            }, 100);
          }
          
          // Force UI update for real-time messages
          
          return {
            messages: sortedMessages,
            conversations: updatedConversations,
            lastUpdate: new Date().toISOString() // Force UI update
          };
        }),
        
        updateMessage: (messageId, updates) => set((state) => ({
          messages: state.messages.map(m => 
            m.id === messageId ? { ...m, ...updates } : m
          )
        })),
        
        clearMessages: () => set({ messages: [] }),
        
        // UI actions
        setTyping: (userId, isTyping) => set((state) => {
          const newSet = new Set(state.currentlyTyping);
          if (isTyping) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return { currentlyTyping: newSet };
        }),
        
        setUserPresence: (userId, presence) => set((state) => {
          const newMap = new Map(state.userPresence);
          newMap.set(userId, presence);
          return { userPresence: newMap };
        }),
        
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        setSearchQuery: (query) => set({ searchQuery: query }),
        setShowEmojiPicker: (show) => set({ showEmojiPicker: show }),
        setShowAudioRecorder: (show) => set({ showAudioRecorder: show }),
        
        // Real-time actions
        startTyping: () => {
          const state = get();
          const currentConversation = state.currentConversation;
          if (!currentConversation || state.isTyping) return;
          
          set({ isTyping: true });
          
          const status = socketService.getConnectionStatus();
          if (status.connected) {
            socketService.emit('typing_start', {
              conversationId: currentConversation.id,
              senderType: 'agent',
              senderName: 'Agent'
            });
          } else {
            console.log('📝 Typing indicator skipped - Socket.IO not available');
          }
          
          const timeout = setTimeout(() => {
            get().stopTyping();
          }, 3000);
          
          set({ typingTimeout: timeout });
        },
        
        stopTyping: () => {
          const state = get();
          const currentConversation = state.currentConversation;
          if (!currentConversation || !state.isTyping) return;
          
          if (state.typingTimeout) {
            clearTimeout(state.typingTimeout);
          }
          
          set({ isTyping: false, typingTimeout: null });
          
          const status = socketService.getConnectionStatus();
          if (status.connected) {
            socketService.emit('typing_stop', {
              conversationId: currentConversation.id,
              senderType: 'agent',
              senderName: 'Agent'
            });
          }
        },
        
        markMessageAsRead: (messageId) => {
          const state = get();
          const currentConversation = state.currentConversation;
          if (!currentConversation) return;
          
          const status = socketService.getConnectionStatus();
          if (status.connected) {
            socketService.emit('mark_message_read', {
              conversationId: currentConversation.id,
              messageId: messageId,
              senderType: 'agent'
            });
          }
          get().updateMessage(messageId, { status: 'read' });
        },
        
        // Clean up polling when component unmounts
        cleanupPolling: () => {
          console.log('🧹 Cleaning up polling intervals...');
          if ((window as any).omniPollInterval) {
            console.log('🛑 Stopping polling...');
            clearInterval((window as any).omniPollInterval);
            (window as any).omniPollInterval = null;
          }
          if ((window as any).omniFallbackInterval) {
            console.log('🛑 Stopping fallback polling...');
            clearInterval((window as any).omniFallbackInterval);
            (window as any).omniFallbackInterval = null;
          }
          
          // Clean up socket status interval
          const state = get();
          if (state.socketStatusInterval) {
            console.log('🛑 Stopping socket status monitoring...');
            clearInterval(state.socketStatusInterval);
            set({ socketStatusInterval: null });
          }
          
          // Disconnect socket service
          socketService.disconnect();
        },

        // ROBUST Socket.IO initialization with retry mechanism
        initializeSocketIO: async () => {
          console.log('🔌 ROBUST: Initializing Socket.IO with retry mechanism...');
          
          try {
            // Connect using the robust socket service
            await socketService.connect();
            // Set up event listeners using the new service - WITH DEDUPLICATION
            socketService.on('new_message', (data: any) => {
              
              if (data && (data.id || data.message?.id)) {
                // Handle both direct message data and wrapped message data
                const messageData = data.message || data;
                const messageId = messageData.id;
                
                // DEDUPLICATION: Check if message already exists
                const existingMessage = get().messages.find(msg => msg.id === messageId);
                if (existingMessage) {
                  return;
                }
                
                // Ensure proper message structure
                const message = {
                  ...messageData,
                  timestamp: messageData.timestamp || messageData.created_at || new Date().toISOString(),
                  created_at: messageData.created_at || messageData.timestamp || new Date().toISOString(),
                  sender: messageData.sender || {
                    id: messageData.sender_id || 'user',
                    name: messageData.sender_name || 'User',
                    platform: data.platform || messageData.platform || 'line',
                    profile_picture_url: messageData.profile_picture_url
                  }
                };
                
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
              }
            });

            socketService.on('user_message', (data: any) => {
              if (data && data.id && data.sender_type === 'user') {
                // DEDUPLICATION: Check if message already exists
                const existingMessage = get().messages.find(msg => msg.id === data.id);
                if (existingMessage) {
                  return;
                }
                
                // Extract profile_picture_url from multiple possible locations for maximum compatibility
                const profilePictureUrl = data.sender?.profile_picture_url || 
                                         data.profile_picture_url || 
                                         data.sender?.pictureUrl ||
                                         null;
                
                const message = {
                  ...data,
                  timestamp: data.timestamp || data.created_at || new Date().toISOString(),
                  created_at: data.created_at || data.timestamp || new Date().toISOString(),
                  profile_picture_url: profilePictureUrl, // Add to message level for direct access
                  sender: data.sender || {
                    id: data.sender_id || 'user',
                    name: data.sender_name || 'User',
                    platform: data.platform || 'line',
                    profile_picture_url: profilePictureUrl
                  },
                  platform: data.platform || 'line',
                  conversation_id: data.conversation_id
                };
                console.log('✅ Adding user message to store:', message.id);
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
              }
            });

            socketService.on('whatsapp_message', (data: any) => {
              console.log('📱 ROBUST: WhatsApp message event received:', data);
              console.log('📱 ROBUST: Platform:', data.platform);
              console.log('📱 ROBUST: Message ID:', data.message?.id || data.id);
              
              if (data && (data.id || data.message?.id)) {
                const messageData = data.message || data;
                const messageId = messageData.id;
                
                // DEDUPLICATION: Check if message already exists
                const existingMessage = get().messages.find(msg => msg.id === messageId);
                if (existingMessage) {
                  console.log('🚫 DUPLICATE PREVENTION: WhatsApp message already exists:', messageId);
                  return;
                }
                
                const message = {
                  ...messageData,
                  timestamp: messageData.timestamp || messageData.created_at || new Date().toISOString(),
                  created_at: messageData.created_at || messageData.timestamp || new Date().toISOString(),
                  sender: messageData.sender || {
                    id: messageData.sender_id || 'user',
                    name: messageData.sender_name || 'WhatsApp User',
                    platform: 'whatsapp',
                    profile_picture_url: messageData.profile_picture_url
                  }
                };
                
                console.log('📱 ROBUST: Processed WhatsApp message:', message);
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
                console.log('✅ ROBUST: WhatsApp message added, UI should update now');
              }
            });

            socketService.on('message_received', (data: any) => {
              console.log('📥 ROBUST: Message received event:', data);
              console.log('📥 ROBUST: Platform:', data.platform);
              
              if (data && (data.id || data.message?.id)) {
                const messageData = data.message || data;
                const messageId = messageData.id;
                
                // DEDUPLICATION: Check if message already exists
                const existingMessage = get().messages.find(msg => msg.id === messageId);
                if (existingMessage) {
                  console.log('🚫 DUPLICATE PREVENTION: Received message already exists:', messageId);
                  return;
                }
                
                const message = {
                  ...messageData,
                  timestamp: messageData.timestamp || messageData.created_at || new Date().toISOString(),
                  created_at: messageData.created_at || messageData.timestamp || new Date().toISOString(),
                  sender: messageData.sender || {
                    id: messageData.sender_id || 'user',
                    name: messageData.sender_name || 'User',
                    platform: data.platform || messageData.platform || 'line',
                    profile_picture_url: messageData.profile_picture_url
                  }
                };
                
                console.log('📥 ROBUST: Processed received message:', message);
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
                console.log('✅ ROBUST: Received message added, UI should update now');
              }
            });

            // Additional event listeners for comprehensive coverage
            socketService.on('incoming_message', (data: any) => {
              console.log('📨 ROBUST: Incoming message event:', data);
              if (data && (data.id || data.message?.id)) {
                const messageData = data.message || data;
                const messageId = messageData.id;
                
                // DEDUPLICATION: Check if message already exists
                const existingMessage = get().messages.find(msg => msg.id === messageId);
                if (existingMessage) {
                  console.log('🚫 DUPLICATE PREVENTION: Incoming message already exists:', messageId);
                  return;
                }
                
                const message = {
                  ...messageData,
                  timestamp: messageData.timestamp || messageData.created_at || new Date().toISOString(),
                  created_at: messageData.created_at || messageData.timestamp || new Date().toISOString(),
                  sender: messageData.sender || {
                    id: messageData.sender_id || 'user',
                    name: messageData.sender_name || 'User',
                    platform: data.platform || messageData.platform || 'line',
                    profile_picture_url: messageData.profile_picture_url
                  }
                };
                
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
                console.log('✅ ROBUST: Incoming message added');
              }
            });

            socketService.on('real_user_message', (data: any) => {
              console.log('🎯 ROBUST: Real user message event:', data);
              if (data && (data.id || data.message?.id)) {
                const messageData = data.message || data;
                const messageId = messageData.id;
                
                // DEDUPLICATION: Check if message already exists
                const existingMessage = get().messages.find(msg => msg.id === messageId);
                if (existingMessage) {
                  console.log('🚫 DUPLICATE PREVENTION: Real user message already exists:', messageId);
                  return;
                }
                
                const message = {
                  ...messageData,
                  timestamp: messageData.timestamp || messageData.created_at || new Date().toISOString(),
                  created_at: messageData.created_at || messageData.timestamp || new Date().toISOString(),
                  sender: messageData.sender || {
                    id: messageData.sender_id || 'user',
                    name: messageData.sender_name || 'Real User',
                    platform: data.platform || messageData.platform || 'line',
                    profile_picture_url: messageData.profile_picture_url
                  }
                };
                
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
                console.log('✅ ROBUST: Real user message added');
              }
            });

            socketService.on('real_user_message', (data: any) => {
              console.log('🎯 ROBUST: Real user message event received:', data);
              console.log('🖼️ ROBUST: Profile picture in real_user_message:', data.sender?.profile_picture_url);
              if (data && data.id && data.sender_type === 'user') {
                const message = {
                  ...data,
                  timestamp: data.timestamp || data.created_at || new Date().toISOString(),
                  created_at: data.created_at || data.timestamp || new Date().toISOString(),
                  sender: data.sender || {
                    id: data.sender_id || 'user',
                    name: data.sender_name || 'User',
                    platform: data.platform || 'line',
                    profile_picture_url: data.profile_picture_url
                  }
                };
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
              }
            });

            socketService.on('universal_message', (data: any) => {
              console.log('🌐 ROBUST: Universal message event received:', data);
              console.log('🖼️ ROBUST: Profile picture in universal_message:', data.sender?.profile_picture_url);
              if (data && data.id) {
                const message = {
                  ...data,
                  timestamp: data.timestamp || data.created_at || new Date().toISOString(),
                  created_at: data.created_at || data.timestamp || new Date().toISOString(),
                  sender: data.sender || {
                    id: data.sender_id || 'user',
                    name: data.sender_name || 'User',
                    platform: data.platform || 'line',
                    profile_picture_url: data.profile_picture_url
                  }
                };
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
              }
            });

            socketService.on('line_message', (data: any) => {
              console.log('📱 ROBUST: LINE message event received:', data);
              console.log('🖼️ ROBUST: Profile picture in line_message:', data.sender?.profile_picture_url);
              if (data && data.id) {
                const message = {
                  ...data,
                  timestamp: data.timestamp || data.created_at || new Date().toISOString(),
                  created_at: data.created_at || data.timestamp || new Date().toISOString(),
                  sender: data.sender || {
                    id: data.sender_id || 'user',
                    name: data.sender_name || 'User',
                    platform: data.platform || 'line',
                    profile_picture_url: data.profile_picture_url
                  }
                };
                get().addMessage(message);
                set({ lastUpdate: new Date().toISOString() });
              }
            });

            // Listen for message sent events
            socketService.on('message_sent', (data: any) => {
              console.log('📤 ROBUST: Message sent event received:', data);
              if (data && data.id) {
                get().updateMessage(data.id, { status: 'sent' });
                set({ lastUpdate: new Date().toISOString() });
              }
            });

            socketService.on('message_received', (data: any) => {
              console.log('📥 ROBUST: Message received event:', data);
              if (data && data.id) {
                get().updateMessage(data.id, { status: 'received' });
                set({ lastUpdate: new Date().toISOString() });
              }
            });

            
            // Monitor connection status
            const checkConnectionStatus = () => {
              const status = socketService.getConnectionStatus();
              console.log('🔍 ROBUST: Connection status:', status);
              
              if (!status.connected) {
                console.warn('⚠️ ROBUST: Socket disconnected, attempting force reconnection...');
                socketService.forceReconnect().catch(error => {
                  console.error('❌ ROBUST: Force reconnection failed:', error);
                });
              }
            };

            // Check connection status every 10 seconds (more responsive)
            const statusInterval = setInterval(checkConnectionStatus, 10000);
            
            // Store interval ID for cleanup
            set({ socketStatusInterval: statusInterval });
            
            console.log('✅ ROBUST: Socket.IO initialized with retry mechanism');
            
          } catch (error) {
            console.error('❌ ROBUST: Failed to initialize Socket.IO:', error);
            // Retry after 5 seconds
            setTimeout(() => {
              console.log('🔄 ROBUST: Retrying Socket.IO connection...');
              get().initializeSocketIO();
            }, 5000);
          }
        },

        // Enhanced dynamic conversation loading with better error handling
        loadConversations: async () => {
          const state = get();
          const now = Date.now();
          const THROTTLE_DURATION = 1000; // Reduced throttling for better responsiveness
          
          if (state.lastConversationLoad && (now - state.lastConversationLoad) < THROTTLE_DURATION) {
            console.log('🚫 Throttling conversation load - too frequent');
            return;
          }
          
          console.log('🔄 Loading conversations...');
          set({ isLoadingConversations: true, conversationError: null, lastConversationLoad: now });
          
          try {
            const conversations = await ApiService.getConversations();
            console.log('📥 Loaded conversations:', conversations.length);
            console.log('📋 Conversation details:', conversations.map((c: Conversation) => ({ id: c.id, user_name: c.user_name, platform: c.platform })));
            
            if (conversations.length === 0) {
              console.log('⚠️ No conversations found - this might be expected for new users');
            }
            
            set({ conversations, isLoadingConversations: false });
            set({ lastUpdate: new Date().toISOString() });
            
            // Join the first conversation room for real-time updates
            if (conversations.length > 0) {
              const firstConversation = conversations[0];
              console.log(`🚪 Joining conversation room: ${firstConversation.id}`);
              socketService.joinConversation(firstConversation.id);
              
              // Also set as current conversation for immediate display
              get().setCurrentConversation(firstConversation);
              
              // Load messages immediately for the selected conversation (initial load)
              console.log(`📥 Loading messages for conversation: ${firstConversation.id}`);
              get().loadMessages(firstConversation.id); // MINIMAL: Load messages
            }
          } catch (error: any) {
            console.error('❌ Failed to load conversations:', error);
            console.error('❌ Error details:', error.response?.data || error.message);
            
            // Try to provide more helpful error information
            let errorMessage = 'Failed to load conversations';
            if (error.response?.status === 404) {
              errorMessage = 'API endpoint not found - check backend server';
            } else if (error.response?.status === 500) {
              errorMessage = 'Backend server error - check server logs';
            } else if (error.code === 'ECONNREFUSED') {
              errorMessage = 'Cannot connect to backend server - check if server is running';
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            set({ 
              conversationError: errorMessage,
              isLoadingConversations: false 
            });
          }
        },
        
        fetchConversations: async () => {
          return get().loadConversations();
        },
        
        forceReloadConversations: async () => {
          console.log('🔄 Force reloading conversations...');
          set({ conversations: [], currentConversation: null, selectedConversationId: null });
          
          try {
            await get().loadConversations();
            console.log('✅ Conversations force reloaded successfully');
          } catch (error) {
            console.error('❌ Failed to reload conversations:', error);
            // Try direct API call as fallback
            try {
              const conversations = await ApiService.getConversations();
              console.log('📥 Fallback: Loaded conversations directly:', conversations.length);
              set({ conversations, lastUpdate: new Date().toISOString() });
            } catch (fallbackError) {
              console.error('❌ Fallback also failed:', fallbackError);
            }
          }
          
          // Force UI update after reload
          set({ lastUpdate: new Date().toISOString() });
        },
        
        clearCache: () => {
          console.log('🧹 Clearing all cached data...');
          localStorage.removeItem('omni-chat-storage');
          set(initialState);
        },
        
        refreshConversations: async () => {
          console.log('🔄 Refreshing conversations for real-time sync...');
          try {
            const conversations = await ApiService.getConversations();
            console.log('📥 Refreshed conversations:', conversations.length);
            
            set({ 
              conversations,
              lastUpdate: new Date().toISOString()
            });
            
            console.log('✅ Conversations refreshed successfully');
          } catch (error: any) {
            console.error('❌ Failed to refresh conversations:', error);
          }
        },
        
        loadConversation: async (conversationId) => {
          try {
            const response = await ApiService.getConversation(conversationId);
            const conversation = (response as any)?.data || response;
            if (conversation && typeof conversation === 'object' && 'id' in conversation) {
              get().setCurrentConversation(conversation as Conversation);
            }
          } catch (error: any) {
            set({ conversationError: error.message || 'Failed to load conversation' });
          }
        },
        
        loadMessages: async (conversationId) => {
          console.log('🔄 HYBRID: Loading messages for:', conversationId);
          set({ isLoadingMessages: true, messageError: null });
          
          try {
            // FIXED: Remove limit restriction - retrieve ALL messages (up to 9999)
            const limit = 9999;
            const offset = 0;
            
            const result = await ApiService.getConversationMessages(conversationId, {
              limit,
              offset,
              order: 'DESC'
            });
            
            console.log('📥 HYBRID: Loaded messages:', result.messages.length, 'of', result.total);
            
            // PROFILE PICTURE FIX: Enhance user messages with conversation profile picture
            const currentConversation = get().currentConversation;
            const messagesWithTimestamps = result.messages.map((msg: Message) => {
              let enhancedMsg = {
                ...msg,
                timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
                created_at: msg.created_at || msg.timestamp || new Date().toISOString()
              };
              
              // For user messages, ensure they have the correct profile picture
              if (msg.sender_type === 'user' && currentConversation) {
                console.log(`🖼️ PROFILE FIX: Enhancing loaded message with conversation profile picture`);
                enhancedMsg = {
                  ...enhancedMsg,
                  sender: {
                    id: enhancedMsg.sender?.id || enhancedMsg.sender_id || 'user',
                    name: currentConversation.user_name || enhancedMsg.sender?.name || enhancedMsg.sender_name || 'User',
                    platform: enhancedMsg.sender?.platform || enhancedMsg.platform || 'line',
                    profile_picture_url: currentConversation.profile_picture_url || enhancedMsg.sender?.profile_picture_url || undefined
                  },
                  sender_name: currentConversation.user_name || enhancedMsg.sender_name || 'User'
                };
              }
              
              return enhancedMsg;
            });
            
            messagesWithTimestamps.sort((a: Message, b: Message) => {
              const timeA = new Date(a.timestamp || a.created_at).getTime();
              const timeB = new Date(b.timestamp || b.created_at).getTime();
              return timeA - timeB;
            });
            
            // HYBRID: Smart history preservation - NEVER replace existing messages
            const currentMessages = get().messages;
            console.log(`🔄 HYBRID: Current messages: ${currentMessages.length}, New messages: ${messagesWithTimestamps.length}`);
            
            // ALWAYS preserve existing messages - only add new ones
            console.log('🔄 HYBRID: Preserving all existing messages, adding new ones');
            // Create a map of existing messages for quick lookup
            const existingMessagesMap = new Map(currentMessages.map(m => [m.id, m]));
            
            // Find messages that are new or updated
            const newOrUpdatedMessages = messagesWithTimestamps.filter(msg => {
              const existing = existingMessagesMap.get(msg.id);
              return !existing || existing.content !== msg.content || existing.status !== msg.status;
            });
            
            if (newOrUpdatedMessages.length > 0) {
              console.log(`📨 HYBRID: Adding ${newOrUpdatedMessages.length} new/updated messages`);
              
              // Merge messages intelligently
              const mergedMessages = [...currentMessages];
              newOrUpdatedMessages.forEach(newMsg => {
                const existingIndex = mergedMessages.findIndex(m => m.id === newMsg.id);
                if (existingIndex >= 0) {
                  // Update existing message
                  mergedMessages[existingIndex] = newMsg;
                } else {
                  // Add new message
                  mergedMessages.push(newMsg);
                }
              });
              
              // Sort by timestamp
              mergedMessages.sort((a, b) => {
                const timeA = new Date(a.timestamp || a.created_at).getTime();
                const timeB = new Date(b.timestamp || b.created_at).getTime();
                return timeA - timeB;
              });
              
              set({ 
                messages: mergedMessages,
                totalMessageCount: result.total,
                hasMoreMessages: result.hasMore,
                isLoadingMessages: false
              });
            } else {
              console.log('📊 HYBRID: No new/updated messages to add');
              set({ 
                totalMessageCount: result.total,
                hasMoreMessages: result.hasMore,
                isLoadingMessages: false 
              });
            }
            
            console.log('✅ HYBRID: Messages loaded successfully');
          } catch (error: any) {
            console.error('❌ HYBRID: Failed to load messages:', error);
            set({ 
              messageError: error.message || 'Failed to load messages',
              isLoadingMessages: false 
            });
          }
        },

        fetchMessages: async (conversationId) => {
          return get().loadMessages(conversationId);
        },

        loadMessageCount: async (conversationId) => {
          try {
            const totalCount = await ApiService.getConversationMessageCount(conversationId);
            set({ totalMessageCount: totalCount });
            console.log('📊 Total message count:', totalCount);
          } catch (error: any) {
            console.error('❌ Failed to load message count:', error);
          }
        },

        sendAutoResponse: async (message, platform) => {
          const currentConversation = get().currentConversation;
          if (!currentConversation) {
            console.log('🚫 Cannot send auto-response - no conversation');
            return;
          }

          try {
            console.log(`🤖 Sending auto-response for ${platform}:`, message);
            await get().sendMessage(message, 'text', undefined, undefined, currentConversation.id);
            console.log('✅ Auto-response sent successfully');
          } catch (error: any) {
            console.error('❌ Failed to send auto-response:', error);
          }
        },

        getAutoResponseTemplates: async (platform) => {
          try {
            const templates = await ApiService.getAutoResponseTemplates(platform);
            console.log('📋 Auto-response templates loaded:', templates.length);
            return templates;
          } catch (error: any) {
            console.error('❌ Failed to load auto-response templates:', error);
            return [];
          }
        },

        // HYBRID sendMessage - IMMEDIATE UI UPDATE
        sendMessage: async (content: string, type: string = 'text', mediaUrl?: string, mediaType?: string, conversationId?: string) => {
          const state = get();
          const targetConversationId = conversationId || state.currentConversation?.id;
          const targetConversation = state.conversations.find(conv => conv.id === targetConversationId);
          
          if (!targetConversationId || state.isSendingMessage) {
            console.log('🚫 HYBRID: Cannot send message');
            return;
          }
          
          // CRITICAL: Enhanced duplicate prevention with multiple layers
          const now = Date.now();
          
          // Layer 1: Check if already sending any message
          if (state.isSendingMessage) {
            console.log('🚫 LAYER 1: Already sending a message, preventing duplicate');
            return;
          }
          
          // Layer 2: Check content-based deduplication (10 seconds)
          if (state.lastMessageSent === content && (now - state.lastMessageTime) < 10000) {
            console.log('🚫 LAYER 2: Duplicate content prevented (same content within 10 seconds)');
            console.log(`🚫 LAYER 2: Last message: "${state.lastMessageSent}"`);
            console.log(`🚫 LAYER 2: Time difference: ${now - state.lastMessageTime}ms`);
            return;
          }
          
          // Layer 3: Check if this exact message is already pending
          const messageHash = `${content}_${targetConversationId}_${now}`;
          if (state.pendingMessages.has(messageHash)) {
            console.log('🚫 LAYER 3: Message already pending, preventing duplicate');
            return;
          }
          
          // Layer 4: Check if message already exists in UI (5 seconds)
          const existingMessage = state.messages.find(msg => 
            msg.content === content && 
            msg.sender_type === 'agent' && 
            msg.conversation_id === targetConversationId &&
            (now - new Date(msg.created_at).getTime()) < 5000
          );
          
          if (existingMessage) {
            console.log('🚫 LAYER 4: Message already exists in UI:', existingMessage.id);
            console.log('🚫 LAYER 4: Content:', content);
            console.log('🚫 LAYER 4: Time difference:', now - new Date(existingMessage.created_at).getTime());
            return;
          }
          
          // CRITICAL: Add unique message ID to prevent any duplicates
          const uniqueMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log(`🔑 UNIQUE MESSAGE ID: ${uniqueMessageId}`);
          
          // Add to pending messages
          const newPendingMessages = new Set(state.pendingMessages);
          newPendingMessages.add(messageHash);
          
          set({ 
            isSendingMessage: true,
            lastMessageSent: content,
            lastMessageTime: now,
            currentMessageId: uniqueMessageId,
            pendingMessages: newPendingMessages
          });
          
          try {
            // HYBRID: Create message immediately for instant UI feedback
            const messageId = uniqueMessageId; // Use the unique ID we generated
            const message: Message = {
              id: messageId,
              content,
              type,
              sender_type: 'agent',
              sender: {
                id: 'omni_business',
                name: 'Omni Agent',
                platform: targetConversation?.platform || 'line'
              },
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString(),
              status: 'sending',
              media_url: mediaUrl,
              media_type: mediaType,
              conversation_id: targetConversationId
            };
            
            // HYBRID: Add message immediately for instant display
            get().addMessage(message);
            set({ lastUpdate: new Date().toISOString() });
            
            console.log('📤 HYBRID: Sending message:', content);
            console.log('📤 HYBRID: Target conversation:', targetConversation);
            console.log('📤 HYBRID: Platform detected:', targetConversation?.platform || 'line');
            
            try {
              const sentMessage = await ApiService.sendMessage(targetConversationId, {
                content,
                messageType: (type as 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker') || 'text',
                mediaUrl,
                mediaType,
                platform: targetConversation?.platform || 'line' // Add platform parameter
              });
            
              if (sentMessage) {
                console.log('✅ HYBRID: Message sent successfully');
                get().updateMessage(messageId, { 
                  ...sentMessage,
                  status: 'delivered'
                });
                set({ lastUpdate: new Date().toISOString() });
              } else {
                get().updateMessage(messageId, { status: 'sent' });
                set({ lastUpdate: new Date().toISOString() });
              }
            } catch (apiError) {
              console.error('❌ HYBRID: API send failed:', apiError);
              get().updateMessage(messageId, { status: 'failed' });
              set({ lastUpdate: new Date().toISOString() });
            }
            
          } catch (error) {
            console.error('❌ HYBRID: Send message error:', error);
          } finally {
            // Clean up pending messages and reset state
            const currentState = get();
            const cleanedPendingMessages = new Set(currentState.pendingMessages);
            cleanedPendingMessages.delete(messageHash);
            
            set({ 
              isSendingMessage: false,
              currentMessageId: '',
              pendingMessages: cleanedPendingMessages
            });
          }
        },
        
        reset: () => {
          set(initialState);
          socketService.disconnect();
        }
      }),
      {
        name: 'omni-chat-storage',
        partialize: (state) => ({
          conversations: state.conversations,
          currentConversation: state.currentConversation,
          sidebarOpen: state.sidebarOpen
        })
      }
    ),
    { name: 'chat-store' }
  )
);

export default useChatStore;
