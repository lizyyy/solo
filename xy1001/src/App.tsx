import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import MeasurePage from './pages/MeasurePage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import ShareCard from './pages/ShareCard';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/measure" element={<MeasurePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<ResultPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/share" element={<ShareCard />} />
      </Routes>
    </Layout>
  );
}

export default App;
