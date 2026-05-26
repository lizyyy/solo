import { useGameStore } from './game/state';
import { LevelSelect } from './components/LevelSelect';
import { GameBoard } from './components/GameBoard';

function App() {
  const status = useGameStore((state) => state.status);

  if (status === 'menu') {
    return <LevelSelect />;
  }

  return <GameBoard />;
}

export default App;
