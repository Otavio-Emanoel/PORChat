import React, { useState } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { WebSocketProvider, useWebSocketContext } from './src/context/WebSocketContext';
import { ChatScreen } from './src/screens/ChatScreen';
import { ControllerScreen } from './src/screens/ControllerScreen';
import { AuthScreen } from './src/screens/AuthScreen';

function MainNavigator() {
  const [currentScreen, setCurrentScreen] = useState<'chat' | 'controller'>('chat');
  const { gameState, userProfile, authToken, isLoadingSession } = useWebSocketContext();

  if (isLoadingSession) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#1E1E2E',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  // Not authenticated: Show Login & Register Screen
  if (!userProfile || !authToken) {
    return <AuthScreen />;
  }

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
