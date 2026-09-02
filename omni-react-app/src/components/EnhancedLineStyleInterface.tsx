// omni-react-app/src/components/EnhancedLineStyleInterface.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useChatStore } from '../stores/chatStore';
import VirtualScrollMessages from './VirtualScrollMessages';
import UserAvatar from './UserAvatar';
import ErrorBoundary from './ErrorBoundary';
import { formatLastMessageTime, truncateMessage, getPlatformInfo, getOnlineStatus } from '../utils/platformUtils';
import { getEnhancedUserData } from '../utils/dynamicUserUtils';

const EnhancedLineStyleInterface: React.FC = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'search'>('pending');
  const [newMessage, setNewMessage] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
    conversations,
    messages,
    fetchMessages,
    sendMessage,
    forceReloadConversations,
    clearCache,
    initializeSocketIO
  } = useChatStore();

  
  // Simple initialization with error handling (prevent duplicate calls)
  useEffect(() => {
    if (isInitialized) return;
    
    console.log('🚀 EnhancedLineStyleInterface mounting...');
    const loadData = async () => {
      try {
        // Only initialize Socket.IO here - let App.tsx handle conversation loading
        console.log('🔌 Initializing Socket.IO for real-time communication...');
        initializeSocketIO();
        console.log('✅ Socket.IO initialized');
        
        setIsInitialized(true);
      } catch (error) {
        console.error('❌ Socket.IO initialization failed:', error);
      }
    };
    
    loadData();
  }, [initializeSocketIO, isInitialized]);

  // Smart refresh mechanism - only refresh when needed
  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(async () => {
      // Only refresh if we have no conversations (new user scenario)
      if (conversations.length === 0) {
        console.log('🔄 Smart refresh: No conversations found, checking for new ones...');
        try {
          await forceReloadConversations();
        } catch (error) {
          console.error('❌ Smart refresh failed:', error);
        }
      }
    }, 10000); // Check every 10 seconds only if no conversations
    
    return () => clearInterval(interval);
  }, [isInitialized, conversations.length, forceReloadConversations]);

  // Simple auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      // Always use the first conversation's ID from the API response
      const firstConversation = conversations[0];
      console.log('🔄 Auto-selecting conversation:', firstConversation.id, 'for user:', firstConversation.user_name);
      setSelectedConversationId(firstConversation.id);
    }
  }, [conversations, selectedConversationId]);

  // Load messages when conversation changes (only once)
  useEffect(() => {
    if (selectedConversationId) {
      console.log('📥 Loading messages for conversation:', selectedConversationId);
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId]); // Removed fetchMessages from dependencies to prevent loops

  // Force refresh conversations when lastUpdate changes (for real-time sync)
  useEffect(() => {
    if (conversations.length > 0) {
      console.log('🔄 Last update changed, refreshing conversations...');
      // Force a re-render by updating the selected conversation
      const currentConv = conversations.find(conv => conv.id === selectedConversationId);
      if (currentConv) {
        setSelectedConversationId(currentConv.id);
      }
    }
  }, [conversations.length]); // Trigger when conversation count changes

  const currentConversation = conversations.find(conv => conv.id === selectedConversationId);
  const currentMessages = messages.filter(msg => msg.conversation_id === selectedConversationId);

  // Memoize enhanced user data to prevent excessive re-renders
  const enhancedConversations = useMemo(() => {
    console.log('🔄 Memoizing enhanced conversations...');
    return conversations.map(conversation => {
      const enhancedData = getEnhancedUserData(conversation);
      return {
        ...conversation,
        enhancedData
      };
    });
  }, [conversations]);

  const enhancedCurrentConversation = useMemo(() => {
    if (!currentConversation) return null;
    console.log('🔄 Memoizing enhanced current conversation...');
    const enhancedData = getEnhancedUserData(currentConversation);
    return {
      ...currentConversation,
      enhancedData
    };
  }, [currentConversation]);


  const handleClearCache = () => {
    console.log('🧹 Clearing cache and force reloading...');
    clearCache();
    forceReloadConversations();
  };

  const handleRefreshConversations = async () => {
    console.log('🔄 Manual refresh conversations...');
    await forceReloadConversations();
    if (selectedConversationId) {
      console.log('🔄 Refreshing messages for current conversation...');
      fetchMessages(selectedConversationId);
    }
  };

  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversationId || isSending) return;

    console.log('📤 Sending message to conversation:', selectedConversationId);
    console.log('📤 Message content:', newMessage.trim());

    setIsSending(true); // Disable button immediately
    
    try {
      await sendMessage(newMessage.trim(), 'text', undefined, undefined, selectedConversationId);
      setNewMessage(''); // Clear input only after successful send
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // Don't clear input on error, let user retry
    } finally {
      // Re-enable button after API call completes (success or error)
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations based on search and active tab
  const filteredConversations = useMemo(() => {
    return enhancedConversations.filter(conversation => {
      const matchesSearch = conversation.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           conversation.last_message?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (activeTab === 'search') {
        return matchesSearch;
      }
      
      // For pending/completed tabs, show all conversations that match search
      // since we don't have strict status filtering yet
      return matchesSearch;
    });
  }, [enhancedConversations, searchQuery, activeTab]);

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Enhanced Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">O</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Omni Platform</h1>
              <p className="text-sm text-gray-600 font-medium">Multi-Channel Manager v1.0.0</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 px-4 py-2 bg-green-50 rounded-full">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700">Online</span>
            </div>
            <button
              onClick={handleRefreshConversations}
              className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors mr-2"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleClearCache}
              className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
            >
              Clear Cache
            </button>
            <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Enhanced Sidebar */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-lg">
          {/* Enhanced Search */}
          <div className="p-6 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all duration-200"
              />
              <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Enhanced Tabs */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === 'pending'
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Pending ({filteredConversations.filter(c => c.status === 'pending').length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === 'completed'
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Completed ({filteredConversations.filter(c => c.status === 'completed').length})
              </button>
            </div>
          </div>

          {/* Enhanced Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-400">No conversations yet</p>
                <p className="text-sm text-gray-300 mt-2">Start a conversation to see it here</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-all duration-200 ${
                    selectedConversationId === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Enhanced Avatar with Platform Icon */}
                    <UserAvatar
                      userId={conversation.id}
                      userName={conversation.enhancedData.displayName}
                      platform={conversation.platform || 'line'}
                      profilePictureUrl={conversation.enhancedData.profilePictureUrl}
                      size="lg"
                      showPlatformIcon={true}
                    />
                    
                    <div className="flex-1 min-w-0">
                      {/* User Name and Platform */}
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {conversation.enhancedData.displayName}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 font-medium">
                            {formatLastMessageTime(conversation.last_message_at || conversation.updated_at || new Date().toISOString())}
                          </span>
                        </div>
                      </div>
                      
                      {/* Last Message Preview */}
                      <p className="text-sm text-gray-600 truncate mb-2">
                        {truncateMessage(conversation.last_message || 'No messages yet', 40)}
                      </p>
                      
                      {/* Platform Badge and Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span 
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: getPlatformInfo(conversation.platform).backgroundColor }}
                          >
                            {getPlatformInfo(conversation.platform).icon} {getPlatformInfo(conversation.platform).name}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            conversation.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {conversation.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {(conversation as any).message_count || 0} messages
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Enhanced Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 max-h-screen">
          {enhancedCurrentConversation ? (
            <>
              {/* Enhanced Chat Header */}
              <div className="p-6 border-b border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <UserAvatar
                      userId={enhancedCurrentConversation.id}
                      userName={enhancedCurrentConversation.user_name || enhancedCurrentConversation.enhancedData.displayName}
                      platform={enhancedCurrentConversation.platform || 'line'}
                      profilePictureUrl={enhancedCurrentConversation.profile_picture_url || enhancedCurrentConversation.enhancedData.profilePictureUrl}
                      size="lg"
                      showPlatformIcon={true}
                    />
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h2 className="text-xl font-bold text-gray-900">
                          {enhancedCurrentConversation.enhancedData.displayName}
                        </h2>
                        <span 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: getPlatformInfo(enhancedCurrentConversation.platform).backgroundColor }}
                        >
                          {getPlatformInfo(enhancedCurrentConversation.platform).icon} {getPlatformInfo(enhancedCurrentConversation.platform).name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getOnlineStatus(enhancedCurrentConversation).color }}
                          ></div>
                          <span className="text-sm text-gray-600">
                            {getOnlineStatus(enhancedCurrentConversation).text}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </button>
                    <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Enhanced Messages */}
              <div className="flex-1 overflow-hidden bg-gray-50 relative min-h-0 w-full" style={{ paddingTop: '40px' }}>
                <ErrorBoundary>
                  <VirtualScrollMessages
                    messages={currentMessages}
                    currentConversation={enhancedCurrentConversation}
                    className="h-full w-full"
                  />
                </ErrorBoundary>
              </div>

              {/* Ultra Dynamic Message Input */}
              <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-xl relative z-20">
                <div className="flex items-end space-x-3">
                  {/* Attachment Button */}
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  
                  {/* Dynamic Input Container */}
                  <div className="flex-1 relative">
                    <div className="relative">
                      <textarea
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white focus:bg-white transition-all duration-200 text-sm shadow-md hover:shadow-lg min-h-[44px] max-h-32 overflow-hidden"
                        rows={1}
                        style={{
                          height: 'auto',
                          minHeight: '44px',
                          maxHeight: '128px'
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                        }}
                      />
                      
                      {/* Character Counter */}
                      {newMessage.length > 0 && (
                        <div className="absolute bottom-1 right-12 text-xs text-gray-400">
                          {newMessage.length}/1000
                        </div>
                      )}
                      
                      {/* Emoji Button */}
                      <button className="absolute right-3 top-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Typing Indicator */}
                    {newMessage.length > 0 && (
                      <div className="absolute -top-8 left-0 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm">
                        Typing...
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Send Button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className={`px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 ${
                      newMessage.trim() && !isSending 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isSending ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="text-sm">Sending...</span>
                      </div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
                
                {/* Quick Actions */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 12h6m-6 4h6" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    Press Enter to send, Shift+Enter for new line
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Select a conversation</h3>
                <p className="text-lg text-gray-600">Choose a conversation from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedLineStyleInterface;
