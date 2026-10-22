import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { WebSocketProvider, useWebSocketContext } from './src/context/WebSocketContext';
import { ChatScreen } from './src/screens/ChatScreen';
import { ControllerScreen } from './src/screens/ControllerScreen';

function MainNavigator() {
  const [currentScreen, setCurrentScreen] = useState<'chat' | 'controller'>('chat');
  const { gameState } = useWebSocketContext();

  // If a game becomes active and user is on chat, auto-prompt or switch
  const isGameActive = gameState && gameState.phase !== 'CHAT';

  return (
    <>
      <StatusBar barStyle={currentScreen === 'controller' ? 'light-content' : 'dark-content'} />
      {currentScreen === 'controller' || isGameActive ? (
        <ControllerScreen onClose={() => setCurrentScreen('chat')} />
      ) : (
        <ChatScreen onOpenController={() => setCurrentScreen('controller')} />
      )}
    </>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <MainNavigator />
    </WebSocketProvider>
  );
}
