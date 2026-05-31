import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Overview } from './pages/Overview';
import { RecordDetail } from './pages/RecordDetail';
import { Review } from './pages/Review';
import { Guide } from './pages/Guide';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-mono-50">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/record/:id" element={<RecordDetail />} />
            <Route path="/review" element={<Review />} />
            <Route path="/guide" element={<Guide />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
