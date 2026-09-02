import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Paper, 
  ClickAwayListener,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  EmojiEmotions as EmojiIcon,
  Mic as MicIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import EmojiPicker from 'emoji-picker-react';
import AudioRecorder from './AudioRecorder';
import type { MessageInputProps } from '../types';
import { useChatStore } from '../stores/chatStore';

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { 
    showEmojiPicker: globalShowEmojiPicker, 
    setShowEmojiPicker: setGlobalShowEmojiPicker,
    isSendingMessage 
  } = useChatStore();

  const handleSendMessage = () => {
    if (inputValue.trim() && !disabled && !isSendingMessage) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      setShowEmojiPicker(false);
      setGlobalShowEmojiPicker(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    const emoji = emojiData.emoji;
    setInputValue(prev => prev + emoji);
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleAudioRecordingComplete = (audioBlob: Blob) => {
    // Convert audio blob to base64 for API
    const reader = new FileReader();
    reader.onload = () => {
      const base64Audio = reader.result as string;
      const base64Data = base64Audio.split(',')[1]; // Remove data:audio/wav;base64, prefix
      
      onSendMessage('[Audio Message]', 'audio', base64Data, 'audio/wav');
    };
    reader.readAsDataURL(audioBlob);
    
    setShowAudioRecorder(false);
  };

  const toggleEmojiPicker = () => {
    const newShowEmojiPicker = !showEmojiPicker;
    setShowEmojiPicker(newShowEmojiPicker);
    setGlobalShowEmojiPicker(newShowEmojiPicker);
    
    if (newShowEmojiPicker) {
      setShowAudioRecorder(false);
    }
  };

  const toggleAudioRecorder = () => {
    const newShowAudioRecorder = !showAudioRecorder;
    setShowAudioRecorder(newShowAudioRecorder);
    
    if (newShowAudioRecorder) {
      setShowEmojiPicker(false);
      setGlobalShowEmojiPicker(false);
    }
  };

  useEffect(() => {
    setShowEmojiPicker(globalShowEmojiPicker);
  }, [globalShowEmojiPicker]);

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <ClickAwayListener onClickAway={() => {
          setShowEmojiPicker(false);
          setGlobalShowEmojiPicker(false);
        }}>
          <Paper
            sx={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              mb: 1,
              p: 1,
              maxHeight: '300px',
              overflow: 'hidden',
              zIndex: 1000,
              boxShadow: 3
            }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={280}
              height={300}
              previewConfig={{
                showPreview: false
              }}
              skinTonesDisabled
              searchDisabled={false}
            />
          </Paper>
        </ClickAwayListener>
      )}

      {/* Audio Recorder */}
      {showAudioRecorder && (
        <ClickAwayListener onClickAway={() => setShowAudioRecorder(false)}>
          <Paper
            sx={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              mb: 1,
              p: 2,
              minWidth: '300px',
              zIndex: 1000,
              boxShadow: 3
            }}
          >
            <AudioRecorder onRecordingComplete={handleAudioRecordingComplete} />
          </Paper>
        </ClickAwayListener>
      )}

      {/* Message Input */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'bottom',
          gap: 1,
          p: 1,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1
        }}
      >
        <Tooltip title="Emoji">
          <IconButton
            onClick={toggleEmojiPicker}
            color={showEmojiPicker ? 'primary' : 'default'}
            disabled={disabled}
          >
            <EmojiIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Audio Message">
          <IconButton
            onClick={toggleAudioRecorder}
            color={showAudioRecorder ? 'primary' : 'default'}
            disabled={disabled}
          >
            <MicIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Attachment">
          <IconButton
            disabled={disabled}
            onClick={() => {
              // TODO: Implement file upload
              console.log('File upload not implemented yet');
            }}
          >
            <AttachFileIcon />
          </IconButton>
        </Tooltip>

        <TextField
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          multiline
          maxRows={4}
          variant="outlined"
          size="small"
          fullWidth
          disabled={disabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            }
          }}
        />

        <Tooltip title={isSendingMessage ? "Sending..." : "Send Message"}>
          <span>
            <IconButton
              onClick={handleSendMessage}
              color="primary"
              disabled={!inputValue.trim() || disabled || isSendingMessage}
              sx={{
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'action.disabledBackground',
                  color: 'action.disabled'
                }
              }}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default MessageInput;
