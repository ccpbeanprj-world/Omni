import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Person as PersonIcon,
  Circle as CircleIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  DoNotDisturb as DoNotDisturbIcon
} from '@mui/icons-material';
import { useChatStore } from '../stores/chatStore';

interface PresenceIndicatorProps {
  userId: string;
  userName?: string;
  showStatus?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  userId,
  userName,
  showStatus = true,
  size = 'medium'
}) => {
  const { userPresence } = useChatStore();
  const [presence, setPresence] = useState<{ status: string; timestamp: string; userName?: string } | null>(null);

  useEffect(() => {
    const userPresenceData = userPresence.get(userId);
    setPresence(userPresenceData || null);
  }, [userPresence, userId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'away':
        return 'warning';
      case 'busy':
        return 'error';
      case 'offline':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon sx={{ fontSize: 12 }} />;
      case 'away':
        return <ScheduleIcon sx={{ fontSize: 12 }} />;
      case 'busy':
        return <DoNotDisturbIcon sx={{ fontSize: 12 }} />;
      case 'offline':
        return <CircleIcon sx={{ fontSize: 12 }} />;
      default:
        return <CircleIcon sx={{ fontSize: 12 }} />;
    }
  };

  const getAvatarSize = () => {
    switch (size) {
      case 'small':
        return { width: 24, height: 24 };
      case 'large':
        return { width: 48, height: 48 };
      default:
        return { width: 32, height: 32 };
    }
  };

  const getBadgeSize = () => {
    switch (size) {
      case 'small':
        return { width: 8, height: 8 };
      case 'large':
        return { width: 16, height: 16 };
      default:
        return { width: 12, height: 12 };
    }
  };

  const displayName = presence?.userName || userName || 'User';
  const status = presence?.status || 'offline';
  const lastSeen = presence?.timestamp;

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {displayName}
          </Typography>
          <Typography variant="caption">
            Status: {status}
          </Typography>
          {lastSeen && (
            <Typography variant="caption" sx={{ display: 'block' }}>
              Last seen: {new Date(lastSeen).toLocaleString()}
            </Typography>
          )}
        </Box>
      }
      arrow
    >
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <Box
              sx={{
                width: getBadgeSize().width,
                height: getBadgeSize().height,
                borderRadius: '50%',
                bgcolor: `${getStatusColor(status)}.main`,
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {getStatusIcon(status)}
            </Box>
          }
        >
          <Avatar sx={getAvatarSize()}>
            <PersonIcon />
          </Avatar>
        </Badge>

        {showStatus && (
          <Chip
            icon={getStatusIcon(status)}
            label={status}
            size="small"
            color={getStatusColor(status) as any}
            sx={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.7rem',
              height: 20
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default PresenceIndicator;




















