import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ImportPage from './pages/ImportPage';
import RecordsPage from './pages/RecordsPage';
import RoutePage from './pages/RoutePage';
import ReviewPage from './pages/ReviewPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ImportPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/route" element={<RoutePage />} />
        <Route path="/review" element={<ReviewPage />} />
      </Route>
    </Routes>
  );
}
