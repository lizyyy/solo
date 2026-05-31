import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from '@/components/layout/Header';
import ListPage from '@/pages/ListPage';
import DetailPage from '@/pages/DetailPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/record/:id" element={<DetailPage />} />
        </Routes>
      </div>
    </Router>
  );
}
