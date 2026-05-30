import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainPage } from './pages/Main';
import { HistoryPage } from './pages/History';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
