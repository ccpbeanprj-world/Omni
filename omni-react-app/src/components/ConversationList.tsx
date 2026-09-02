import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  Chip,
  Badge,
  TextField,
  Paper,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
// import { Business as BusinessIcon } from '@mui/icons-material'; // Unused
import { useChatStore } from '../stores/chatStore';
import { getPlatformConfig } from '../utils/platforms';
// import ApiService from '../services/api'; // Unused for now
import type { Conversation } from '../types';

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ onSelectConversation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  // const [lineBotProfile, setLineBotProfile] = useState<any>(null); // Unused
  
  const {
    conversations,
    currentConversation,
    isLoadingConversations,
    conversationError,
    loadConversations,
    setSearchQuery: setGlobalSearchQuery
  } = useChatStore();

  // Load LINE bot profile
  // const loadLineBotProfile = async () => {
  //   try {
  //     // const response = await ApiService.getLineBotProfile(); // Not implemented in ApiService
  //     // if (response.success) {
  //     //   setLineBotProfile(response.data);
  //     // }
  //   } catch (error) {
  //     console.error('Failed to load LINE bot profile:', error);
  //   }
  // };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    // loadLineBotProfile(); // Disabled
  }, [loadConversations]);

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conversation => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const userName = conversation.user_name?.toLowerCase() || '';
    const platformConversationId = conversation.platform_conversation_id?.toLowerCase() || '';
    const lastMessage = conversation.last_message?.toLowerCase() || '';
    
    return userName.includes(query) || 
           platformConversationId.includes(query) || 
           lastMessage.includes(query);
  });

  const formatLastMessage = (conversation: Conversation): string => {
    if (conversation.last_message) {
      return conversation.last_message.length > 50 
        ? conversation.last_message.substring(0, 50) + '...'
        : conversation.last_message;
    }
    return 'No messages yet';
  };

  const formatLastMessageTime = (timestamp?: string): string => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
    onSelectConversation(conversation);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    setGlobalSearchQuery(value);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* LINE Business Account Info - DISABLED */}
      {/* {false && (
        <Paper elevation={1} sx={{ p: 2, borderRadius: 0, backgroundColor: 'primary.light' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <BusinessIcon sx={{ mr: 1, color: 'primary.contrastText' }} />
            <Typography variant="subtitle2" sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
              LINE Business Account
            </Typography>
          </Box>
        </Paper>
      )} */}

      {/* Search Header */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <TextField
          fullWidth
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          size="small"
          variant="outlined"
        />
      </Paper>

      {/* Conversations List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoadingConversations && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              Loading conversations...
            </Typography>
          </Box>
        )}

        {conversationError && (
          <Alert severity="error" sx={{ m: 2 }}>
            {conversationError}
          </Alert>
        )}

        {!isLoadingConversations && !conversationError && (
          <List sx={{ py: 0 }}>
            {filteredConversations.map((conversation) => {
              const platformConfig = getPlatformConfig(conversation.platform);
              const isActive = currentConversation?.id === conversation.id;
              
              return (
                <ListItem key={conversation.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleConversationClick(conversation)}
                    selected={isActive}
                    sx={{
                      py: 1.5,
                      px: 2,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light + 10%',
                        '&:hover': {
                          backgroundColor: 'primary.light + 15%',
                        },
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Badge
                          badgeContent={conversation.unread_count || 0}
                          color="error"
                          invisible={!conversation.unread_count || conversation.unread_count === 0}
                        >
                          {/* Platform icon overlay */}
                          <Box sx={{ position: 'relative' }}>
                            <Avatar
                              src={conversation.profile_picture_url}
                              alt={conversation.user_name || 'User'}
                              sx={{ 
                                width: 48, 
                                height: 48,
                                bgcolor: conversation.profile_picture_url ? 'transparent' : platformConfig.color + '20'
                              }}
                            >
                              {!conversation.profile_picture_url && platformConfig.icon}
                            </Avatar>
                            {/* Platform indicator */}
                            <Chip
                              label={platformConfig.icon}
                              size="small"
                              sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                minWidth: 20,
                                height: 20,
                                fontSize: '0.6rem',
                                backgroundColor: platformConfig.color,
                                color: 'white',
                                '& .MuiChip-label': {
                                  px: 0.5
                                }
                              }}
                            />
                          </Box>
                        </Badge>
                      </Stack>
                    </ListItemAvatar>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* User name and platform */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography
                          variant="subtitle2"
                          noWrap
                          sx={{
                            fontWeight: isActive ? 'bold' : 'normal',
                            color: (conversation.unread_count || 0) > 0 ? 'text.primary' : 'text.secondary',
                          }}
                        >
                          {conversation.user_name || 'Unknown User'}
                        </Typography>
                        
                        {/* Online status indicator */}
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: conversation.last_message_at ? 
                              (Date.now() - new Date(conversation.last_message_at).getTime() < 5 * 60 * 1000 ? 'success.main' : 'warning.main') :
                              'grey.400',
                            ml: 0.5
                          }}
                          title={
                            conversation.last_message_at ?
                              (Date.now() - new Date(conversation.last_message_at).getTime() < 5 * 60 * 1000 ? 'Online' : 'Recently active') :
                              'Offline'
                          }
                        />
                        
                        <Chip
                          label={`${platformConfig.icon} ${platformConfig.name}`}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            height: '20px',
                            backgroundColor: platformConfig.color + '20',
                            color: platformConfig.color,
                            ml: 0.5
                          }}
                        />
                      </Box>

                      {/* Last message and timestamp */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          sx={{ flex: 1, mr: 1 }}
                        >
                          {formatLastMessage(conversation)}
                        </Typography>
                        
                        {conversation.last_message_at && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ flexShrink: 0 }}
                          >
                            {formatLastMessageTime(conversation.last_message_at)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}

        {!filteredConversations.length && !isLoadingConversations && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ConversationList;

