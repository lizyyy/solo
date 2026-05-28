import { GameProvider } from './context/GameContext';
import { GameBoard } from './components/GameBoard';
import './index.css';

function App() {
  return (
    <GameProvider>
      <GameBoard />
    </GameProvider>
  );
}

export default App;
