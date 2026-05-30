import { useState } from 'react';
import { HomePage } from './pages/Home';
import { HistoryPage } from './pages/HistoryPage';

type Page = 'home' | 'history';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  if (currentPage === 'history') {
    return <HistoryPage onBack={() => setCurrentPage('home')} />;
  }

  return <HomePage onGoToHistory={() => setCurrentPage('history')} />;
}

export default App;
