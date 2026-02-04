import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import Game from './Game';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111' }}>
      <StatusBar barStyle="light-content" />
      <Game />
    </SafeAreaView>
  );
}
