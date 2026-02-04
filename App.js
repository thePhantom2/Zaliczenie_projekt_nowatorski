import React, { useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import Menu from "./Menu";
import Game from "./Game";

export default function App() {
  const [screen, setScreen] = useState("menu"); // 'menu' | 'game'
  const [difficulty, setDifficulty] = useState("easy"); // 'easy' | 'hard'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#081229" }}>
      <StatusBar barStyle="light-content" />
      {screen === "menu" ? (
        <Menu
          onStart={(mode) => {
            setDifficulty(mode);
            setScreen("game");
          }}
        />
      ) : (
        <Game difficulty={difficulty} onExit={() => setScreen("menu")} />
      )}
    </SafeAreaView>
  );
}
