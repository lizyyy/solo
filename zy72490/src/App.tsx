import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Home } from '@/pages/Home';
import { Review } from '@/pages/Review';
import { History } from '@/pages/History';
import { Wizard } from '@/pages/Wizard';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/review" element={<Review />} />
            <Route path="/history" element={<History />} />
            <Route path="/wizard" element={<Wizard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
