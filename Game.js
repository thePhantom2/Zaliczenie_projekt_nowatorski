import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Accelerometer } from "expo-sensors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Tablea stałych
const BALL_RADIUS = 16;
const PLATFORM_HEIGHT = 16;
const PLATFORM_WIDTH = 140;
const PLATFORM_Y = SCREEN_HEIGHT - 200; // pozycja platformy wgzlędem wysokości
const GRAVITY = 500; // px/s^2
const RESTITUTION = 1.02; // zachowana energia po odbicu od platforamy
const SIDE_FRICTION = 0.85; //  zachowana energia po odbicu od bocznej krawędzi ekranu
const ACCEL_SENSITIVITY = 1000; // jak szybko platforma się porusza
const ACCEL_UPDATE_MS = 10; // odświerzanie acclerometra w mili sekunadach

export default function Game() {
  // funckaja do aktualizowania ekranu
  const [, setTick] = useState(0); // odświerzania ekranu
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(true);

  //Zmienne odniesienia do stanu gry
  const ball = useRef({
    x: SCREEN_WIDTH / 2,
    y: PLATFORM_Y - 300,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
  });
  const platform = useRef({
    x: (SCREEN_WIDTH - PLATFORM_WIDTH) / 2,
    width: PLATFORM_WIDTH,
    y: PLATFORM_Y,
  });
  const accelX = useRef(0);
  const lastTimestamp = useRef(null);
  const rafId = useRef(null);

  function resetGame() {
    ball.current.x = SCREEN_WIDTH / 2;
    ball.current.y = PLATFORM_Y - 300;
    ball.current.vx = 0;
    ball.current.vy = 0;
    platform.current.x = (SCREEN_WIDTH - PLATFORM_WIDTH) / 2;
    setScore(0);
    setRunning(true);
    lastTimestamp.current = null;
    setTick((t) => t + 1);
  }

  // Czytanie danych z Accelerometer
  useEffect(() => {
    Accelerometer.setUpdateInterval(ACCEL_UPDATE_MS);
    const sub = Accelerometer.addListener((data) => {
      accelX.current = data.x;
    });

    return () => {
      sub && sub.remove();
    };
  }, []);

  // Main loop
  useEffect(() => {
    function step(timestamp) {
      if (!lastTimestamp.current) {
        lastTimestamp.current = timestamp;
        rafId.current = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min((timestamp - lastTimestamp.current) / 1000, 0.033);
      lastTimestamp.current = timestamp;

      if (running) {
        updatePhysics(dt);
      }

      //wyzwalacz renderowania
      setTick((t) => t + 1);

      rafId.current = requestAnimationFrame(step);
    }

    rafId.current = requestAnimationFrame(step);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [running]);

  function updatePhysics(dt) {
    const b = ball.current;
    const p = platform.current;

    //Ruch platformy zależny od danych z acclerometra
    const desiredVx = accelX.current * ACCEL_SENSITIVITY; // px/s
    p.x += desiredVx * dt;
    if (p.x < 0) p.x = 0;
    if (p.x + p.width > SCREEN_WIDTH) p.x = SCREEN_WIDTH - p.width;

    //Fizyka piłki
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    //Uderzanie boczną krawędz ekranu (żeby pilka nie uciekała za pola widzenia)
    if (b.x - b.radius < 0) {
      b.x = b.radius;
      b.vx = -b.vx * SIDE_FRICTION;
    } else if (b.x + b.radius > SCREEN_WIDTH) {
      b.x = SCREEN_WIDTH - b.radius;
      b.vx = -b.vx * SIDE_FRICTION;
    }

    //Uderzanie górną krawędz
    if (b.y - b.radius < 0) {
      b.y = b.radius;
      b.vy = -b.vy * RESTITUTION;
    }

    // Kolidowanie z platformą
    const nearestX = Math.max(p.x, Math.min(b.x, p.x + p.width));
    const dy = b.y + b.radius - p.y; //dodatnia, gdy dolna część piłki znajduje się poniżej górnej części platformy
    const distX = Math.abs(nearestX - b.x);
    const collidedWithPlatform =
      dy >= 0 &&
      b.y - b.radius <= p.y && //piłka znajduje się nad platformą
      distX <= b.radius + 0.0001;

    if (collidedWithPlatform && b.vy > 0) {
      //danie piłki na góre platformy w chwili uderzenia
      b.y = p.y - b.radius - 0.01;
      //odbicie
      b.vy = -Math.abs(b.vy) * RESTITUTION;

      //Nadaj pewną prędkość poziomą w oparciu o ruch platformy
      b.vx += desiredVx * 0.35; // przekaz siły ruchu platformy na piłke

      //wynik
      setScore((s) => s + 1);
    }

    //Sprawdza czy piłka wypadła prez dół ekranu
    if (b.y - b.radius > SCREEN_HEIGHT) {
      setRunning(false);
    }
  }

  const b = ball.current;
  const p = platform.current;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.scoreText}>Bounces: {score}</Text>
        <Text style={styles.hintText}>Tilt device to move platform</Text>
      </View>

      <View style={styles.playArea}>
        {/* Ball */}
        <View
          style={[
            styles.ball,
            {
              width: b.radius * 2,
              height: b.radius * 2,
              borderRadius: b.radius,
              transform: [
                { translateX: b.x - b.radius },
                { translateY: b.y - b.radius },
              ],
            },
          ]}
        />

        {/* Platform */}
        <View
          style={[
            styles.platform,
            {
              width: p.width,
              height: PLATFORM_HEIGHT,
              transform: [{ translateX: p.x }, { translateY: p.y }],
            },
          ]}
        />
      </View>

      {!running && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>Game Over</Text>
          <Text style={styles.finalScoreText}>Bounces: {score}</Text>
          <TouchableOpacity
            onPress={resetGame}
            style={styles.button}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Restart</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  topBar: {
    height: 80,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  scoreText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  hintText: { color: "#9aa4b2", fontSize: 12 },
  playArea: { flex: 1 },
  ball: {
    position: "absolute",
    backgroundColor: "#ffd166",
    borderWidth: 2,
    borderColor: "#ffb703",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  platform: {
    position: "absolute",
    backgroundColor: "#06d6a0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#04a77a",
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: "center",
  },
  gameOverText: { color: "#fff", fontSize: 36, fontWeight: "800" },
  finalScoreText: { color: "#fff", fontSize: 22, marginTop: 8 },
  button: {
    marginTop: 14,
    backgroundColor: "#118ab2",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
