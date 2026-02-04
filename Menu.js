import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HS_KEY = "gyro_bounce_highscore_v1";

export default function Menu({ onStart }) {
  const [highScore, setHighScore] = useState(null);
  const [selected, setSelected] = useState("easy");

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem(HS_KEY);
        setHighScore(s ? Number(s) : 0);
      } catch (e) {
        console.warn("Failed to load high score", e);
        setHighScore(0);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gyro Bounce</Text>

      <View style={styles.highScoreBox}>
        <Text style={styles.highScoreLabel}>Najwyższy wynik</Text>
        {highScore === null ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.highScoreValue}>{highScore}</Text>
        )}
      </View>

      <View style={styles.modeBox}>
        <Text style={styles.modeLabel}>Wybierz poziom trudności</Text>
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              selected === "easy" && styles.modeButtonSelected,
            ]}
            onPress={() => setSelected("easy")}
            activeOpacity={0.8}
          >
            <Text style={styles.modeButtonText}>Łatwy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              selected === "hard" && styles.modeButtonSelected,
            ]}
            onPress={() => setSelected("hard")}
            activeOpacity={0.8}
          >
            <Text style={styles.modeButtonText}>Trudny</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => onStart(selected)}
        activeOpacity={0.9}
      >
        <Text style={styles.startButtonText}>Start</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Pochyl urządzenie, aby przesuwać platformę
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ffd166",
    marginBottom: 20,
  },
  highScoreBox: { alignItems: "center", marginBottom: 24 },
  highScoreLabel: { color: "#9aa4b2", fontSize: 16 },
  highScoreValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 6,
  },
  modeBox: { width: "100%", marginBottom: 24, alignItems: "center" },
  modeLabel: { color: "#9aa4b2", marginBottom: 8 },
  buttonsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
  },
  modeButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: "#123",
    borderWidth: 1,
    borderColor: "#234",
  },
  modeButtonSelected: {
    backgroundColor: "#06d6a0",
    borderColor: "#04a77a",
  },
  modeButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  startButton: {
    marginTop: 8,
    backgroundColor: "#118ab2",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  hint: { marginTop: 20, color: "#9aa4b2", fontSize: 12 },
});
