// omni-react-app/src/components/DebugPanel.tsx
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';

const DebugPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const { conversations, messages, isLoadingConversations, conversationError, lastUpdate } = useChatStore();

  useEffect(() => {
    setDebugInfo({
      conversations: conversations.length,
      messages: messages.length,
      isLoadingConversations,
      conversationError,
      lastUpdate: lastUpdate || new Date().toISOString()
    });
  }, [conversations, messages, isLoadingConversations, conversationError, lastUpdate]);

  const testAPI = async () => {
    try {
      console.log('🧪 Testing API directly...');
      const response = await fetch('http://localhost:3000/api/conversations');
      const data = await response.json();
      console.log('✅ API test result:', data);
      alert(`API Test: Found ${data.conversations?.length || 0} conversations`);
    } catch (error) {
      console.error('❌ API test failed:', error);
      alert(`API Test Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px', 
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <h3>🐛 Debug Panel</h3>
      <div>
        <strong>Conversations:</strong> {debugInfo.conversations}<br/>
        <strong>Messages:</strong> {debugInfo.messages}<br/>
        <strong>Loading:</strong> {debugInfo.isLoadingConversations ? 'Yes' : 'No'}<br/>
        <strong>Error:</strong> {debugInfo.conversationError || 'None'}<br/>
        <strong>Last Update:</strong> {debugInfo.lastUpdate}
      </div>
      <button onClick={testAPI} style={{ marginTop: '10px', padding: '5px' }}>
        Test API
      </button>
    </div>
  );
};

export default DebugPanel;