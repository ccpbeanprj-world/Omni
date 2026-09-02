import React, { useEffect, useState } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  Typography,
  Chip
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  Person as PersonIcon,
  Message as MessageIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import socketService from '../services/socketService';
import { useChatStore } from '../stores/chatStore';

interface Notification {
  id: string;
  type: 'message' | 'typing' | 'presence' | 'upload' | 'system';
  title: string;
  message: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  conversationId?: string;
  severity?: 'success' | 'info' | 'warning' | 'error';
}

const RealTimeNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const { currentlyTyping, userPresence } = useChatStore();

  useEffect(() => {
    const status = socketService.getConnectionStatus();
    if (!status.connected) {
      console.log('🔌 Socket not connected, skipping notification setup');
      return;
    }

    // Listen for new messages
    socketService.on('new_message', (data: any) => {
      console.log('🔔 Notification: New message received:', data);
      const notification: Notification = {
        id: `msg_${Date.now()}`,
        type: 'message',
        title: 'New Message',
        message: `${data.sender_name || data.sender?.name || 'User'}: ${data.content}`,
        timestamp: new Date().toISOString(),
        userId: data.sender_id || data.sender?.id,
        userName: data.sender_name || data.sender?.name,
        conversationId: data.conversation_id,
        severity: data.sender_type === 'user' ? 'info' : 'success'
      };
      addNotification(notification);
    });

    // Listen for typing indicators
    socketService.on('user_typing', (data: any) => {
      if (data.isTyping) {
        const notification: Notification = {
          id: `typing_${data.userId}_${Date.now()}`,
          type: 'typing',
          title: 'User Typing',
          message: `${data.userName || 'User'} is typing...`,
          timestamp: new Date().toISOString(),
          userId: data.userId,
          userName: data.userName,
          severity: 'info'
        };
        addNotification(notification);
      }
    });

    // Listen for user presence updates
    socketService.on('user_presence_update', (data: any) => {
      const notification: Notification = {
        id: `presence_${data.userId}_${Date.now()}`,
        type: 'presence',
        title: 'User Status',
        message: `${data.userName || 'User'} is now ${data.status}`,
        timestamp: new Date().toISOString(),
        userId: data.userId,
        userName: data.userName,
        severity: data.status === 'online' ? 'success' : 'info'
      };
      addNotification(notification);
    });

    // Listen for file upload progress
    socketService.on('file_upload_progress', (data: any) => {
      const notification: Notification = {
        id: `upload_${data.fileId}_${Date.now()}`,
        type: 'upload',
        title: 'File Upload',
        message: `Uploading file: ${data.progress}%`,
        timestamp: new Date().toISOString(),
        severity: 'info'
      };
      addNotification(notification);
    });

    // Listen for file upload completion
    socketService.on('file_upload_complete', (data: any) => {
      const notification: Notification = {
        id: `upload_complete_${data.fileId}_${Date.now()}`,
        type: 'upload',
        title: 'File Upload Complete',
        message: `File "${data.fileName}" uploaded successfully`,
        timestamp: new Date().toISOString(),
        severity: 'success'
      };
      addNotification(notification);
    });

    // Listen for system notifications
    socketService.on('system_notification', (data: any) => {
      const notification: Notification = {
        id: `system_${Date.now()}`,
        type: 'system',
        title: data.type || 'System Notification',
        message: data.message || 'System update',
        timestamp: new Date().toISOString(),
        severity: 'info'
      };
      addNotification(notification);
    });

    // Listen for additional message events from backend
    socketService.on('user_message', (data: any) => {
      console.log('🔔 Notification: User message received:', data);
      const notification: Notification = {
        id: `user_msg_${Date.now()}`,
        type: 'message',
        title: 'User Message',
        message: `${data.sender_name || data.sender?.name || 'User'}: ${data.content}`,
        timestamp: new Date().toISOString(),
        userId: data.sender_id || data.sender?.id,
        userName: data.sender_name || data.sender?.name,
        conversationId: data.conversation_id,
        severity: 'info'
      };
      addNotification(notification);
    });

    socketService.on('real_user_message', (data: any) => {
      console.log('🔔 Notification: Real user message received:', data);
      const notification: Notification = {
        id: `real_user_msg_${Date.now()}`,
        type: 'message',
        title: 'Real User Message',
        message: `${data.sender_name || data.sender?.name || 'User'}: ${data.content}`,
        timestamp: new Date().toISOString(),
        userId: data.sender_id || data.sender?.id,
        userName: data.sender_name || data.sender?.name,
        conversationId: data.conversation_id,
        severity: 'info'
      };
      addNotification(notification);
    });

    socketService.on('message_sent', (data: any) => {
      console.log('🔔 Notification: Message sent:', data);
      const notification: Notification = {
        id: `sent_msg_${Date.now()}`,
        type: 'message',
        title: 'Message Sent',
        message: `Sent: ${data.content}`,
        timestamp: new Date().toISOString(),
        conversationId: data.conversation_id,
        severity: 'success'
      };
      addNotification(notification);
    });

    return () => {
      // Cleanup listeners
      socketService.off('new_message');
      socketService.off('user_typing');
      socketService.off('user_presence_update');
      socketService.off('file_upload_progress');
      socketService.off('file_upload_complete');
      socketService.off('system_notification');
      socketService.off('user_message');
      socketService.off('real_user_message');
      socketService.off('message_sent');
    };
  }, []);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only last 5
    setCurrentNotification(notification);
    setOpen(true);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setOpen(false);
    }, 5000);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageIcon />;
      case 'typing':
        return <PersonIcon />;
      case 'presence':
        return <PersonIcon />;
      case 'upload':
        return <UploadIcon />;
      case 'system':
        return <NotificationIcon />;
      default:
        return <NotificationIcon />;
    }
  };

  const getTypingUsers = () => {
    return Array.from(currentlyTyping).map(userId => {
      const presence = userPresence.get(userId);
      return presence?.userName || userId;
    });
  };

  const getOnlineUsers = () => {
    return Array.from(userPresence.entries())
      .filter(([_, presence]) => presence.status === 'online')
      .map(([userId, presence]) => presence.userName || userId);
  };

  return (
    <Box>
      {/* Current notification */}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 8 }}
      >
        <Alert
          onClose={handleClose}
          severity={currentNotification?.severity || 'info'}
          variant="filled"
          sx={{ width: '100%' }}
          icon={currentNotification ? getNotificationIcon(currentNotification.type) : undefined}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {currentNotification?.title}
            </Typography>
            <Typography variant="body2">
              {currentNotification?.message}
            </Typography>
            {currentNotification?.timestamp && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {new Date(currentNotification.timestamp).toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        </Alert>
      </Snackbar>

      {/* Real-time status indicators */}
      <Box sx={{ position: 'fixed', top: 16, left: 16, zIndex: 1000 }}>
        {getTypingUsers().length > 0 && (
          <Chip
            icon={<PersonIcon />}
            label={`${getTypingUsers().join(', ')} typing...`}
            color="primary"
            size="small"
            sx={{ mb: 1, mr: 1 }}
          />
        )}
        
        {getOnlineUsers().length > 0 && (
          <Chip
            icon={<CheckCircleIcon />}
            label={`${getOnlineUsers().length} online`}
            color="success"
            size="small"
            sx={{ mb: 1, mr: 1 }}
          />
        )}
      </Box>

      {/* Notification history (for debugging) */}
      {import.meta.env.DEV && notifications.length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block' }}>
            Recent Notifications ({notifications.length})
          </Typography>
          {notifications.slice(0, 3).map((notification) => (
            <Box
              key={notification.id}
              sx={{
                p: 1,
                mb: 1,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                maxWidth: 300
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getNotificationIcon(notification.type)}
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  {notification.title}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                {notification.message}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default RealTimeNotifications;











