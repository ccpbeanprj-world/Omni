import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  IconButton, 
  Typography, 
  Button,
  Stack,
  LinearProgress
} from '@mui/material';
import {
  Mic as MicIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import type { AudioRecorderProps } from '../types';

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onRecordingComplete, 
  disabled = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const sendRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
      // Reset state
      setAudioBlob(null);
      setRecordingTime(0);
      setIsPlaying(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ p: 2, minWidth: '280px' }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h6" align="center">
          Record Audio Message
        </Typography>

        {/* Recording Timer */}
        <Typography variant="body1" color={isRecording ? 'error.main' : 'text.primary'}>
          {formatTime(recordingTime)}
        </Typography>

        {/* Audio Visualization */}
        {isRecording && (
          <Box sx={{ width: '100%' }}>
            <LinearProgress 
              variant="indeterminate" 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'rgba(0,0,0,0.1)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'error.main'
                }
              }} 
            />
          </Box>
        )}

        {/* Control Buttons */}
        <Stack direction="row" spacing={2} alignItems="center">
          {!audioBlob && (
            <>
              {!isRecording ? (
                <IconButton
                  onClick={startRecording}
                  disabled={disabled}
                  sx={{ 
                    backgroundColor: 'error.main',
                    color: 'white',
                    '&:hover': { backgroundColor: 'error.dark' },
                    width: 56,
                    height: 56
                  }}
                >
                  <MicIcon fontSize="large" />
                </IconButton>
              ) : (
                <IconButton
                  onClick={stopRecording}
                  sx={{ 
                    backgroundColor: 'grey.500',
                    color: 'white',
                    '&:hover': { backgroundColor: 'grey.600' },
                    width: 56,
                    height: 56
                  }}
                >
                  <StopIcon fontSize="large" />
                </IconButton>
              )}
            </>
          )}

          {audioBlob && (
            <>
              <IconButton
                onClick={isPlaying ? stopPlaying : playRecording}
                sx={{ 
                  backgroundColor: 'success.main',
                  color: 'white',
                  '&:hover': { backgroundColor: 'success.dark' },
                  width: 48,
                  height: 48
                }}
              >
                {isPlaying ? <StopIcon /> : <PlayIcon />}
              </IconButton>

              <IconButton
                onClick={sendRecording}
                disabled={disabled}
                sx={{ 
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': { backgroundColor: 'primary.dark' },
                  width: 48,
                  height: 48
                }}
              >
                <SendIcon />
              </IconButton>

              <Button
                onClick={resetRecording}
                variant="outlined"
                size="small"
              >
                Reset
              </Button>
            </>
          )}
        </Stack>

        {/* Instructions */}
        {!audioBlob && !isRecording && (
          <Typography variant="body2" color="text.secondary" align="center">
            Click the microphone to start recording
          </Typography>
        )}

        {isRecording && (
          <Typography variant="body2" color="error.main" align="center">
            Recording... Click stop when done
          </Typography>
        )}

        {audioBlob && (
          <Typography variant="body2" color="text.secondary" align="center">
            Preview your recording before sending
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default AudioRecorder;
