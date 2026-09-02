// omni-react-app/src/App.tsx - LINE Official Account Manager Style Interface
import React, { useEffect } from 'react';
import { useChatStore } from './stores/chatStore';
import EnhancedLineStyleInterface from './components/EnhancedLineStyleInterface';
import DebugPanel from './components/DebugPanel';
import './style.css';

const App: React.FC = () => {
  const initializeSocketIO = useChatStore(state => state.initializeSocketIO);
  const cleanupPolling = useChatStore(state => state.cleanupPolling);
  const loadConversations = useChatStore(state => state.loadConversations);
  const [socketInitialized, setSocketInitialized] = React.useState(false);
  const [conversationsLoaded, setConversationsLoaded] = React.useState(false);
  
  useEffect(() => {
    if (socketInitialized) return;
    
    console.log('🚀 App mounting, initializing Socket.IO...');
    initializeSocketIO();
    setSocketInitialized(true);
  }, [initializeSocketIO, socketInitialized]);

  useEffect(() => {
    if (conversationsLoaded) return;
    
    // Load conversations immediately when app starts - don't wait for Socket.IO
    console.log('🔄 App started, loading conversations immediately...');
    
    const loadConversationsWithRetry = async (retryCount = 0) => {
      try {
        await loadConversations();
        console.log('✅ Conversations loaded successfully');
        setConversationsLoaded(true);
      } catch (error) {
        console.error('❌ Failed to load conversations:', error);
        
        // Retry up to 3 times with increasing delays
        if (retryCount < 3) {
          const delay = (retryCount + 1) * 1000; // 1s, 2s, 3s
          console.log(`🔄 Retrying conversation load in ${delay}ms (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => {
            loadConversationsWithRetry(retryCount + 1);
          }, delay);
        } else {
          console.error('❌ Failed to load conversations after 3 attempts');
          // Still mark as loaded to prevent infinite retries
          setConversationsLoaded(true);
        }
      }
    };
    
    loadConversationsWithRetry();
  }, [loadConversations, conversationsLoaded]);

  // Cleanup polling when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 App unmounting, cleaning up polling...');
      cleanupPolling();
    };
  }, [cleanupPolling]);

  return (
    <div className="App">
      <EnhancedLineStyleInterface />
      <DebugPanel />
    </div>
  );
};

export default App;