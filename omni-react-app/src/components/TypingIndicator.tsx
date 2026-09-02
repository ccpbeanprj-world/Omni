import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Fade,
  CircularProgress
} from '@mui/material';
import {
  Person as PersonIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material';
import { useChatStore } from '../stores/chatStore';

interface TypingIndicatorProps {
  conversationId?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ conversationId }) => {
  const { currentlyTyping, userPresence } = useChatStore();
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string; avatar?: React.ReactElement }>>([]);

  useEffect(() => {
    // Filter typing users for current conversation
    const typingUserIds = Array.from(currentlyTyping);
    const typingUsersData = typingUserIds.map(userId => {
      const presence = userPresence.get(userId);
      return {
        id: userId,
        name: presence?.userName || 'User',
        avatar: presence?.userName ? (
          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
            {presence.userName.charAt(0).toUpperCase()}
          </Avatar>
        ) : (
          <Avatar sx={{ width: 24, height: 24 }}>
            <PersonIcon fontSize="small" />
          </Avatar>
        )
      };
    });

    setTypingUsers(typingUsersData);
  }, [currentlyTyping, userPresence, conversationId]);

  if (typingUsers.length === 0) {
    return null;
  }

  return (
    <Fade in={typingUsers.length > 0}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          mb: 1,
          mx: 1
        }}
      >
        <KeyboardIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {typingUsers.map((user, index) => (
            <Box key={user.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {user.avatar || (
                <Avatar sx={{ width: 20, height: 20, bgcolor: 'primary.main' }}>
                  <PersonIcon sx={{ fontSize: 12 }} />
                </Avatar>
              )}
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                {user.name}
              </Typography>
              {index < typingUsers.length - 1 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  ,
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            is typing
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <CircularProgress size={8} sx={{ animationDelay: '0s' }} />
            <CircularProgress size={8} sx={{ animationDelay: '0.2s' }} />
            <CircularProgress size={8} sx={{ animationDelay: '0.4s' }} />
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default TypingIndicator;











