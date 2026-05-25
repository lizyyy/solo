import { useGameStore } from '@/store/gameStore';
import MainMenu from '@/components/MainMenu';
import GamePage from '@/pages/GamePage';
import ResultScreen from '@/components/ResultScreen';
import ReplayPlayer from '@/components/ReplayPlayer';

export default function App() {
  const { currentPage } = useGameStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'menu':
        return <MainMenu />;
      case 'game':
        return <GamePage />;
      case 'result':
        return <ResultScreen />;
      case 'replay':
        return <ReplayPlayer />;
      default:
        return <MainMenu />;
    }
  };

  return renderPage();
}
