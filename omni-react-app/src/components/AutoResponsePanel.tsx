import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Send as SendIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useChatStore } from '../stores/chatStore';
import { getPlatformConfig } from '../utils/platforms';

interface AutoResponsePanelProps {
  conversationId: string;
  platform: string;
  onClose: () => void;
}

const AutoResponsePanel: React.FC<AutoResponsePanelProps> = ({ 
  platform, 
  onClose 
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendAutoResponse, getAutoResponseTemplates } = useChatStore();
  const platformConfig = getPlatformConfig(platform);

  // Load templates when component mounts
  useEffect(() => {
    loadTemplates();
  }, [platform]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const templateData = await getAutoResponseTemplates(platform);
      setTemplates(templateData);
    } catch (err: any) {
      setError('Failed to load auto-response templates');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setCustomMessage(template.message);
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;
    
    setSending(true);
    setError(null);
    try {
      await sendAutoResponse(selectedTemplate.message, platform);
      setSelectedTemplate(null);
      setCustomMessage('');
    } catch (err: any) {
      setError('Failed to send auto-response');
      console.error('Error sending auto-response:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendCustom = async () => {
    if (!customMessage.trim()) return;
    
    setSending(true);
    setError(null);
    try {
      await sendAutoResponse(customMessage, platform);
      setCustomMessage('');
      setShowCustomDialog(false);
    } catch (err: any) {
      setError('Failed to send custom auto-response');
      console.error('Error sending custom auto-response:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 350,
        height: '100%',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <BotIcon color="primary" />
        <Typography variant="h6" sx={{ flex: 1 }}>
          自動回應訊息
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Platform Info */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip
            label={`${platformConfig.icon} ${platformConfig.name}`}
            size="small"
            sx={{
              backgroundColor: platformConfig.color + '20',
              color: platformConfig.color
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          選擇預設模板或輸入自訂訊息
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Box sx={{ p: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Templates List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {templates.map((template) => (
              <ListItem key={template.id} disablePadding>
                <ListItemButton
                  onClick={() => handleTemplateSelect(template)}
                  selected={selectedTemplate?.id === template.id}
                >
                  <ListItemText
                    primary={template.name}
                    secondary={template.message}
                    secondaryTypographyProps={{
                      sx: { 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Actions */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1
        }}
      >
        <Button
          variant="outlined"
          onClick={() => setShowCustomDialog(true)}
          disabled={sending}
          sx={{ flex: 1 }}
        >
          自訂訊息
        </Button>
        <Button
          variant="contained"
          onClick={handleSendTemplate}
          disabled={!selectedTemplate || sending}
          startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
          sx={{ flex: 1 }}
        >
          {sending ? '發送中...' : '發送'}
        </Button>
      </Box>

      {/* Custom Message Dialog */}
      <Dialog
        open={showCustomDialog}
        onClose={() => setShowCustomDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>自訂自動回應訊息</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="訊息內容"
            fullWidth
            multiline
            rows={4}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomDialog(false)}>
            取消
          </Button>
          <Button
            onClick={handleSendCustom}
            variant="contained"
            disabled={!customMessage.trim() || sending}
            startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {sending ? '發送中...' : '發送'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AutoResponsePanel;
