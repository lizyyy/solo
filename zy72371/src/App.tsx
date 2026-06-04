import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ImportPage from './pages/ImportPage';
import ThresholdPage from './pages/ThresholdPage';
import PlaybackPage from './pages/PlaybackPage';
import HistoryPage from './pages/HistoryPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ImportPage />} />
          <Route path="/threshold" element={<ThresholdPage />} />
          <Route path="/playback/:id" element={<PlaybackPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
