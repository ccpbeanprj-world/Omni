import React from 'react';
import { 
  Box, 
  Typography, 
  Avatar, 
  Paper,
  Chip,
  Stack
} from '@mui/material';
import { Person as PersonIcon, SmartToy as BotIcon } from '@mui/icons-material';
import type { ChatMessageProps } from '../types';
import { getDefaultAvatar } from '../utils/platforms';

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  showAvatar = true 
}) => {
  const isAgent = message.sender_type === 'agent';
  const isAutoResponse = message.sender_type === 'auto_response';
  
  // Get proper avatar URL
  const avatarUrl = (isAgent || isAutoResponse)
    ? null // Agent/auto-response avatars handled by icon
    : (message.conversation_user_profile_picture_url || 
       message.sender_profile_picture_url || 
       getDefaultAvatar(message.sender?.platform || 'unknown'));
  
  // Get proper display name
  const displayName = isAutoResponse
    ? (message.sender_name || 'Omni Auto-Response')  // Auto-response name
    : isAgent 
    ? (message.sender_name || 'Omni Agent')  // Agent name
    : (message.sender_name || message.conversation_user_name || message.sender?.name || 'LINE User');

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'sent': return 'success';
      case 'delivered': return 'info';
      case 'read': return 'primary';
      case 'error': return 'error';
      case 'sending': return 'warning';
      default: return 'default';
    }
  };

  const renderMessageContent = () => {
    if (message.type === 'audio' && message.media_url) {
      return (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Audio Message
          </Typography>
          <audio controls>
            <source src={message.media_url} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        </Box>
      );
    }

    if (message.type === 'image' && message.media_url) {
      return (
        <Box>
          <img 
            src={message.media_url} 
            alt="Message" 
            style={{ maxWidth: '300px', maxHeight: '200px', borderRadius: '8px' }}
          />
          {message.content && message.content !== '[Image]' && (
            <Typography variant="body1" sx={{ mt: 1 }}>
              {message.content}
            </Typography>
          )}
        </Box>
      );
    }

    return (
      <Typography 
        variant="body1" 
        sx={{ 
          wordBreak: 'break-word',
          '& .emoji': {
            fontSize: '1.2em'
          }
        }}
      >
        {message.content}
      </Typography>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: (isAgent || isAutoResponse) ? 'flex-end' : 'flex-start',
        mb: 1,
        px: 2
      }}
    >
      {/* User Avatar (left side for users, hidden for agents/auto-responses) */}
      {!(isAgent || isAutoResponse) && showAvatar && (
        <Avatar 
          src={avatarUrl || undefined} 
          alt={displayName}
          sx={{ 
            width: 35, 
            height: 35, 
            mr: 1,
            bgcolor: 'primary.main'
          }}
        >
          {!avatarUrl && <PersonIcon />}
        </Avatar>
      )}

      {/* Message Bubble */}
      <Box
        sx={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: (isAgent || isAutoResponse) ? 'flex-end' : 'flex-start'
        }}
      >
        {/* Header with name and time */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(message.timestamp || message.created_at)}
          </Typography>
        </Stack>

        {/* Message content */}
        <Paper
          elevation={1}
          sx={{
            p: 1.5,
            backgroundColor: isAutoResponse ? 'secondary.main' : (isAgent ? 'primary.main' : 'background.paper'),
            color: isAutoResponse ? 'secondary.contrastText' : (isAgent ? 'primary.contrastText' : 'text.primary'),
            borderRadius: 2,
            border: (isAgent || isAutoResponse) ? 'none' : '1px solid',
            borderColor: 'grey.300',
            position: 'relative',
            '&::before': isAgent ? {
              content: '""',
              position: 'absolute',
              top: '50%',
              right: '-8px',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: `8px solid ${(theme: any) => theme.palette.primary.main}`
            } : {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '-8px',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: `8px solid ${(theme: any) => theme.palette.background.paper}`,
              borderLeft: 'none'
            }
          }}
        >
          {renderMessageContent()}
        </Paper>

        {/* Message status indicator */}
        {isAgent && message.status && (
          <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center' }}>
            <Chip
              label={message.status}
              size="small"
              color={getStatusColor(message.status) as any}
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: '20px' }}
            />
          </Box>
        )}
      </Box>

      {/* Agent Avatar (right side for agents, hidden for users) */}
      {isAgent && showAvatar && (
        <Avatar
          src={avatarUrl || undefined}
          alt={displayName}
          sx={{ 
            width: 35, 
            height: 35, 
            ml: 1,
            bgcolor: 'primary.main'
          }}
        >
          {!avatarUrl && <BotIcon />}
        </Avatar>
      )}
    </Box>
  );
};

export default ChatMessage;


