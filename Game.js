import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Accelerometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Tablea stałych
const BALL_RADIUS = 16;
const PLATFORM_HEIGHT = 16;
const PLATFORM_WIDTH = 140;
const PLATFORM_Y = SCREEN_HEIGHT - 200; // pozycja platformy wgzlędem wysokości
const GRAVITY = 500; // px/s^2 (nieużywana stała — strojenie robi DIFF)
const RESTITUTION = 1.02; // zachowana energia po odbicu od platforamy (nieużywana — strojenie robi DIFF)
const SIDE_FRICTION = 0.85; //  zachowana energia po odbicu od bocznej krawędzi ekranu
const ACCEL_SENSITIVITY = 1000; // jak szybko platforma się porusza
const ACCEL_UPDATE_MS = 10; // odświerzanie acclerometra w mili sekunadach

// Base key used to create per-difficulty keys.
// This must be defined before any function that references it to avoid ReferenceError.
const HS_KEY_BASE = "gyro_bounce_highscore_v1";

/*
  Zmodyfikowana wersja Game.js:
  - obsługa poziomu trudności (props.difficulty: 'easy' | 'hard')
  - ruchome przeszkody, kolizje z przeszkodami
  - zapis i odczyt najwyższego wyniku (AsyncStorage) — oddzielny rekord dla każdej trudności
  - przycisk powrotu do menu (onExit prop)
  - zachowano i rozszerzono komentarze w języku polskim
*/

export default function Game({ difficulty = "easy", onExit = null }) {
  // funckaja do aktualizowania ekranu
  const [, setTick] = useState(0); // odświerzania ekranu
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(true);
  const [highScore, setHighScore] = useState(null);

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

  // obstacles (ruchome prostokąty)
  const obstacles = useRef([]);

  // Difficulty tuning (nadpisuje niektóre stałe, zależnie od wybranego poziomu)
  const DIFF = {
    easy: {
      gravity: 2000,
      restitution: 0.88,
      platformWidth: Math.min(220, SCREEN_WIDTH * 0.6),
      obstaclesCount: 2,
      obstacleSpeed: 60,
    },
    hard: {
      gravity: 3000,
      restitution: 0.75,
      platformWidth: Math.min(140, SCREEN_WIDTH * 0.35),
      obstaclesCount: 6,
      obstacleSpeed: 160,
    },
  }[difficulty || "easy"];

  // Helper: key for AsyncStorage per difficulty
  function highScoreKeyFor(diff) {
    return `${HS_KEY_BASE}_${diff}`;
  }

  // Inicjalizacja przeszkód
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function initObstacles() {
    const obs = [];
    for (let i = 0; i < DIFF.obstaclesCount; i++) {
      const w = rand(50, 120);
      const h = rand(10, 28);
      const y = rand(80, PLATFORM_Y - 160);
      // range ruchu w poziomie
      const rangeMax = Math.max(40, SCREEN_WIDTH - w - 80);
      const range = rand(40, rangeMax);
      const baseX = rand(20, Math.max(20, SCREEN_WIDTH - w - 20 - range));
      const speed = DIFF.obstacleSpeed * rand(0.7, 1.2);
      const dir = Math.random() < 0.5 ? 1 : -1;
      obs.push({ x: baseX, y, w, h, baseX, range, speed, dir });
    }
    obstacles.current = obs;
  }

  // Reset function
  function resetGame() {
    ball.current.x = SCREEN_WIDTH / 2;
    ball.current.y = PLATFORM_Y - 300;
    ball.current.vx = 0;
    ball.current.vy = 0;
    platform.current.x = (SCREEN_WIDTH - DIFF.platformWidth) / 2;
    platform.current.width = DIFF.platformWidth;
    setScore(0);
    setRunning(true);
    lastTimestamp.current = null;
    initObstacles();
    setTick((t) => t + 1);
  }

  // Load highscore for current difficulty
  async function loadHighScore(diff) {
    try {
      const key = highScoreKeyFor(diff);
      const s = await AsyncStorage.getItem(key);
      setHighScore(s ? Number(s) : 0);
    } catch (e) {
      console.warn("Nie udało się wczytać highscore", e);
      setHighScore(0);
    }
  }

  // Whenever difficulty changes, load its highscore and reset game for that difficulty
  useEffect(() => {
    loadHighScore(difficulty);
    resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  // Czytanie danych z Accelerometer
  useEffect(() => {
    Accelerometer.setUpdateInterval(ACCEL_UPDATE_MS);
    const sub = Accelerometer.addListener((data) => {
      accelX.current = data.x;
    });

    // init obstacles on mount (also resetGame called by difficulty effect)
    initObstacles();

    return () => {
      sub && sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main loop
  useEffect(() => {
    function step(timestamp) {
      if (!lastTimestamp.current) {
        lastTimestamp.current = timestamp;
        rafId.current = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min((timestamp - lastTimestamp.current) / 1000, 0.05);
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

  // Pomocnicze funkcje kolizji
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function circleRectCollision(b, rect) {
    const nearestX = clamp(b.x, rect.x, rect.x + rect.w);
    const nearestY = clamp(b.y, rect.y, rect.y + rect.h);
    const dx = b.x - nearestX;
    const dy = b.y - nearestY;
    const dist2 = dx * dx + dy * dy;
    return {
      collided: dist2 < b.radius * b.radius,
      dx,
      dy,
      dist2,
      nearestX,
      nearestY,
    };
  }

  function reflectVelocityAlongNormal(vx, vy, nx, ny, restitution) {
    // odbicie wektora v względem normalnej n: v' = v - (1+e)*(v·n)*n
    const vdotn = vx * nx + vy * ny;
    const factor = (1 + restitution) * vdotn;
    return {
      vx: vx - factor * nx,
      vy: vy - factor * ny,
    };
  }

  async function trySaveHighScoreIfNeeded(finalScore) {
    try {
      const key = highScoreKeyFor(difficulty);
      const s = await AsyncStorage.getItem(key);
      const prev = s ? Number(s) : 0;
      if (finalScore > prev) {
        await AsyncStorage.setItem(key, String(finalScore));
        setHighScore(finalScore);
      } else {
        setHighScore(prev);
      }
    } catch (e) {
      console.warn("failed to save highscore", e);
    }
  }

  function updatePhysics(dt) {
    const b = ball.current;
    const p = platform.current;

    //Ruch platformy zależny od danych z acclerometra
    // Uwaga: orientacja osi accelerometru może się różnić między urządzeniami.
    // Jeżeli platforma porusza się w przeciwną stronę, odwróć znak accelX przy obliczaniu desiredVx.
    const desiredVx = accelX.current * ACCEL_SENSITIVITY; // px/s (zachowano oryginalną orientację)
    p.x += desiredVx * dt;
    if (p.x < 0) p.x = 0;
    if (p.x + p.width > SCREEN_WIDTH) p.x = SCREEN_WIDTH - p.width;

    //Fizyka piłki (użyj wartości gravity z DIFF dla dynamicznego strojenia)
    b.vy += DIFF.gravity * dt;
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
      b.vy = -b.vy * DIFF.restitution;
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
      //odbicie (użyj restitution z DIFF)
      b.vy = -Math.abs(b.vy) * DIFF.restitution;

      //Nadaj pewną prędkość poziomą w oparciu o ruch platformy
      b.vx += desiredVx * 0.35; // przekaz siły ruchu platformy na piłke

      //dodaj drobne losowe zachwianie aby zachować chaotyczność
      b.vx += rand(-20, 20) * 0.02;

      //wynik
      setScore((s) => s + 1);
    }

    // Przeszkody: aktualizacja pozycji i kolizje
    for (let obs of obstacles.current) {
      // poruszaj przeszkodą po zdefiniowanym zakresie
      obs.x += obs.dir * obs.speed * dt;
      if (obs.x < obs.baseX) {
        obs.x = obs.baseX;
        obs.dir *= -1;
      } else if (obs.x > obs.baseX + obs.range) {
        obs.x = obs.baseX + obs.range;
        obs.dir *= -1;
      }

      const rect = { x: obs.x, y: obs.y, w: obs.w, h: obs.h };
      const res = circleRectCollision(b, rect);
      if (res.collided) {
        // Oblicz normalną i wypchnij piłkę poza przeszkodę
        let dist = Math.sqrt(Math.max(1e-6, res.dist2));
        let nx = res.dx / dist;
        let ny = res.dy / dist;
        if (!isFinite(nx) || !isFinite(ny)) {
          // środek wewnątrz prostokąta -> wymuś odbicie w górę
          nx = 0;
          ny = -1;
        }
        const overlap = b.radius - dist;
        b.x += nx * overlap;
        b.y += ny * overlap;

        // odbicie według normalnej z dodatkowym chaotycznym przyrostem
        const newV = reflectVelocityAlongNormal(
          b.vx,
          b.vy,
          nx,
          ny,
          DIFF.restitution
        );
        b.vx = newV.vx + rand(-30, 30) * 0.02;
        b.vy = newV.vy + rand(-30, 30) * 0.02;
      }
    }

    //Sprawdza czy piłka wypadła przez dół ekranu
    if (b.y - b.radius > SCREEN_HEIGHT) {
      setRunning(false);

      // zapisz wynik jeżeli jest nowym rekordem (oddzielnie dla każdego poziomu)
      trySaveHighScoreIfNeeded(score);
    }
  }

  // Render helpers to read current state
  const b = ball.current;
  const p = platform.current;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.scoreText}>Bounces: {score}</Text>

        {/* dodano wsparcie dla powrotu do menu i pokazanie trybu */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.hintText}>
            {difficulty === "easy" ? "Łatwy" : "Trudny"}
          </Text>
          <TouchableOpacity
            onPress={() => onExit && onExit()}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>Menu</Text>
          </TouchableOpacity>
        </View>
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

        {/* Obstacles */}
        {obstacles.current.map((o, i) => (
          <View
            key={i}
            style={[
              styles.obstacle,
              {
                width: o.w,
                height: o.h,
                transform: [{ translateX: o.x }, { translateY: o.y }],
                backgroundColor: difficulty === "easy" ? "#ff6b6b" : "#ff4d4d",
              },
            ]}
          />
        ))}
      </View>

      {!running && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>Koniec gry</Text>
          <Text style={styles.finalScoreText}>Bounces: {score}</Text>
          <TouchableOpacity
            onPress={resetGame}
            style={styles.button}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Restart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onExit && onExit()}
            style={[styles.button, { marginTop: 12, backgroundColor: "#555" }]}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Menu</Text>
          </TouchableOpacity>

          <Text style={{ color: "#9aa4b2", marginTop: 8 }}>
            Najlepszy wynik ({difficulty === "easy" ? "Łatwy" : "Trudny"}):{" "}
            {highScore === null ? "-" : highScore}
          </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  hintText: { color: "#9aa4b2", fontSize: 12, marginRight: 12 },
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
  obstacle: {
    position: "absolute",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.3)",
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
  smallButton: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#234",
    borderRadius: 8,
  },
  smallButtonText: { color: "#fff", fontSize: 12 },
});
