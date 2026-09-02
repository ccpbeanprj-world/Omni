// omni-react-app/src/components/LineStyleInterface.tsx
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';
import VirtualScrollMessages from './VirtualScrollMessages';
import UserAvatar from './UserAvatar';

const LineStyleInterface: React.FC = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'search'>('pending');
  
  const {
    conversations,
    messages,
    fetchConversations,
    fetchMessages,
    sendMessage
  } = useChatStore();

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId]); // Removed fetchMessages from dependencies to prevent loops

  const currentConversation = conversations.find(conv => conv.id === selectedConversationId);
  const currentMessages = messages.filter(msg => msg.conversation_id === selectedConversationId);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !selectedConversationId) return;
    
    await sendMessage(content);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = e.currentTarget.value.trim();
      if (content) {
        handleSendMessage(content);
        e.currentTarget.value = '';
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - LINE Style */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">O</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Omni Platform</h1>
                  <p className="text-sm text-gray-500">Multi-Channel Manager</p>
                </div>
              </div>
            <div className="flex items-center space-x-2">
              <button className="px-3 py-1 bg-blue-500 text-white text-sm rounded">Pro 立即開始使用Chat Pro</button>
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">B</span>
              </div>
              <button className="text-gray-500 hover:text-gray-700">?</button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex border-b border-gray-200">
          <button className="flex-1 py-3 px-4 text-center border-b-2 border-green-500 text-green-500 font-medium">
            <div className="w-6 h-6 mx-auto mb-1">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            聊天
          </button>
          <button className="flex-1 py-3 px-4 text-center text-gray-500 hover:text-gray-700">
            <div className="w-6 h-6 mx-auto mb-1">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            聯絡人
          </button>
          <button className="flex-1 py-3 px-4 text-center text-gray-500 hover:text-gray-700">
            <div className="w-6 h-6 mx-auto mb-1">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
            </div>
            設定
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="flex space-x-2">
            <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">全部</button>
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="搜尋"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversationId(conversation.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedConversationId === conversation.id ? 'bg-gray-100' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <UserAvatar
                  userId={conversation.id}
                  userName={conversation.user_name || 'Unknown User'}
                  platform={conversation.platform || 'line'}
                  profilePictureUrl={conversation.profile_picture_url}
                  size="lg"
                  showPlatformIcon={true}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {conversation.user_name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
                        </svg>
                      </button>
                      <button className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {conversation.last_message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Total: {conversations.length}</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    userId={currentConversation.id}
                    userName={currentConversation.user_name || 'Unknown User'}
                    platform={currentConversation.platform || 'line'}
                    profilePictureUrl={currentConversation.profile_picture_url}
                    size="md"
                    showPlatformIcon={true}
                  />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {currentConversation.user_name}
                    </h2>
                    <p className="text-sm text-gray-500">LINE Business Account</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                    </svg>
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'pending'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                待處理
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'completed'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                處理完畢
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'search'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Q 搜尋
              </button>
            </div>

            {/* Messages with Virtual Scroll */}
            <div className="flex-1 p-4">
              <VirtualScrollMessages 
                messages={currentMessages}
                currentConversation={currentConversation}
                className="h-full"
              />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-end space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.415 5 5 0 007.072 0z" clipRule="evenodd"/>
                  </svg>
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                  </svg>
                </button>
                
                <div className="flex-1">
                  <textarea
                    placeholder="Enter: 傳送 / Shift + Enter: 換行"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={1}
                    onKeyPress={handleKeyPress}
                    onFocus={() => {}}
                    onBlur={() => {}}
                  />
                </div>
                
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-1">
                  <span>傳送</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <p>No conversations yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LineStyleInterface;
