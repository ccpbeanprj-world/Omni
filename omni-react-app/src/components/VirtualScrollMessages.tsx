// Dynamic Messages Component with Fixed Layout - No Overlap
import React, { useEffect, useRef, useState } from 'react';
import type { Message } from '../types';
import UserAvatar from './UserAvatar';
import { useChatStore } from '../stores/chatStore';

interface VirtualScrollMessagesProps {
  messages: Message[];
  currentConversation: any;
  className?: string;
}

const VirtualScrollMessages: React.FC<VirtualScrollMessagesProps> = ({
  messages,
  currentConversation,
  className = ''
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { loadMessages, hasMoreMessages } = useChatStore();

  // Sort messages by timestamp (oldest first, newest at bottom) - NO useMemo for real-time updates
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.created_at).getTime();
    const timeB = new Date(b.timestamp || b.created_at).getTime();
    return timeA - timeB; // Oldest first (ascending order)
  });

  // Auto-scroll to bottom when new messages arrive - CRITICAL for real-time display
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sortedMessages.length]); // Re-run when message count changes

  // Load more messages when scrolling to top
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    
    // Load more messages when scrolled near the top
    if (scrollTop < 100 && hasMoreMessages && !isLoadingMore && currentConversation) {
      setIsLoadingMore(true);
      try {
        await loadMessages(currentConversation.id, false); // Changed to false to preserve history
      } catch (error) {
        console.error('Failed to load more messages:', error);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  // Handle empty messages
  if (!sortedMessages || sortedMessages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-400">No messages yet</p>
          <p className="text-sm text-gray-300 mt-2">Start the conversation!</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Calculate dynamic message bubble size based on content
  const getMessageBubbleClass = (content: string) => {
    const length = content.length;
    if (length < 20) return 'max-w-xs';
    if (length < 50) return 'max-w-sm';
    if (length < 100) return 'max-w-md';
    return 'max-w-lg';
  };

  return (
    <div
      ref={messagesContainerRef}
      className={`flex flex-col overflow-y-auto ${className}`}
      style={{ 
        height: 'calc(100vh - 450px)', // More space for header to prevent overlap
        maxWidth: '100%',
        minHeight: '750px', // Increased minimum height
        paddingTop: '60px', // More padding from top to prevent overlap
        paddingBottom: '60px', // More padding from bottom
        marginTop: '30px' // Additional margin to push content down
      }}
      onScroll={handleScroll}
    >
      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
            <span>Loading more messages...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col px-6 py-12 space-y-10"> {/* Even more padding and spacing to prevent overlap */}
        {sortedMessages.map((message, index) => {
          const isUser = message.sender_type === 'user';
          const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
          const showDate = !prevMessage || 
            new Date(message.timestamp || message.created_at).toDateString() !== 
            new Date(prevMessage.timestamp || prevMessage.created_at).toDateString();

          return (
            <div key={message.id} className="w-full mb-8"> {/* Even more margin bottom for better spacing */}
              {showDate && (
                <div className="flex items-center justify-center my-8"> {/* Increased margin */}
                  <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
                    <span>{new Date(message.timestamp || message.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-4`}> {/* More margin bottom */}
                <div className={`flex items-end space-x-2 ${isUser ? 'flex-row' : 'flex-row-reverse space-x-reverse'} max-w-[80%]`}>
                  {/* Avatar - only show for first message or when sender changes */}
                  {(!prevMessage || message.sender_type !== prevMessage.sender_type || message.sender_id !== prevMessage.sender_id) && (
                    (() => {
                      // CRITICAL FIX: Get userName with platform-specific priority
                      let finalUserName = isUser ? 'User' : 'Omni Agent';
                      
                      if (isUser) {
                        const platform = currentConversation?.platform || message.platform || 'line';
                        
                        // LINE: Use conversation.user_name as primary source (most reliable)
                        // Other platforms: Try sender_name first, then fallback to conversation.user_name
                        if (platform === 'line') {
                          // LINE: conversation_user_name > message.sender_name > others
                          if (currentConversation?.user_name && currentConversation.user_name.trim().length > 0) {
                            finalUserName = currentConversation.user_name;
                          } else if (message.sender_name && typeof message.sender_name === 'string' && message.sender_name.trim().length > 0) {
                            finalUserName = message.sender_name;
                          } else if (message.sender?.name && message.sender.name.trim().length > 0) {
                            finalUserName = message.sender.name;
                          } else if (message.content && message.content.trim().length > 0) {
                            finalUserName = message.content;
                          }
                        } else {
                          // Other platforms (WhatsApp, Facebook, etc.): message.sender_name first
                          if (message.sender_name && typeof message.sender_name === 'string' && message.sender_name.trim().length > 0) {
                            finalUserName = message.sender_name;
                          } else if (currentConversation?.user_name && currentConversation.user_name.trim().length > 0) {
                            finalUserName = currentConversation.user_name;
                          } else if (message.sender?.name && message.sender.name.trim().length > 0) {
                            finalUserName = message.sender.name;
                          } else if (message.content && message.content.trim().length > 0) {
                            finalUserName = message.content;
                          }
                        }
                      }
                      
                      // For WhatsApp, extract phone number from sender_name if needed
                      if (currentConversation?.platform === 'whatsapp' && isUser && !finalUserName.match(/^[A-Za-z]/)) {
                        const phoneMatch = finalUserName.match(/\+?(\d{1,3})?(\d{4,})/);
                        if (phoneMatch && phoneMatch[2]) {
                          const lastFourDigits = phoneMatch[2].slice(-4);
                          finalUserName = `User ${lastFourDigits}`;
                        }
                      }
                      
                      // Get the best available profile picture URL from message or conversation
                      // Priority: message.sender.profile_picture_url > message.profile_picture_url > conversation.profile_picture_url > null
                      const profilePictureUrl = isUser ? (
                        message.sender?.profile_picture_url || 
                        message.profile_picture_url ||
                        currentConversation?.profile_picture_url || 
                        currentConversation?.enhancedData?.profilePictureUrl || 
                        null
                      ) : undefined;
                      
                      return (
                        <UserAvatar
                          userId={isUser ? (message.sender?.id || message.sender_id || message.id) : "agent"}
                          userName={finalUserName}
                          platform={currentConversation?.platform || message.platform || 'line'}
                          profilePictureUrl={profilePictureUrl}
                      size="sm"
                      showPlatformIcon={true}
                      className="flex-shrink-0"
                    />
                      );
                    })()
                  )}

                  {/* Message Bubble */}
                  <div className={`flex flex-col ${isUser ? 'items-start' : 'items-end'} min-w-0 flex-1`}>
                    <div className={`relative px-6 py-5 rounded-2xl ${getMessageBubbleClass(message.content || '')} ${
                      isUser 
                        ? 'bg-gray-100 text-gray-900 shadow-sm' 
                        : 'bg-blue-500 text-white shadow-sm'
                    }`}> {/* Even more padding for better spacing */}
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {message.content || 'No content'}
                      </p>
                      
                      {/* Timestamp */}
                      <div className={`text-xs mt-2 ${
                        isUser ? 'text-gray-500' : 'text-blue-100'
                      }`}>
                        {formatTime(message.timestamp || message.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll anchor - CRITICAL for real-time display */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default VirtualScrollMessages;