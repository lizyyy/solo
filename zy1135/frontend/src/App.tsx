import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useGameStore } from './store/gameStore';
import StartScreen from './pages/StartScreen';
import GameScreen from './pages/GameScreen';
import GameOverScreen from './pages/GameOverScreen';

function App() {
  const { gameId, loadGame, currentGame } = useGameStore();

  useEffect(() => {
    if (gameId && !currentGame) {
      loadGame(gameId).catch(() => {
        useGameStore.getState().reset();
      });
    }
  }, [gameId, currentGame, loadGame]);

  return (
    <Routes>
      <Route path="/" element={currentGame ? <Navigate to="/game" replace /> : <StartScreen />} />
      <Route
        path="/game"
        element={
          currentGame ? (
            currentGame.gameOver ? (
              <Navigate to="/game-over" replace />
            ) : (
              <GameScreen />
            )
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/game-over"
        element={
          currentGame?.gameOver ? <GameOverScreen /> : <Navigate to="/" replace />
        }
      />
    </Routes>
  );
}

export default App;
