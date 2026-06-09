import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import Workbench from './pages/Workbench';
import Review from './pages/Review';

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-full flex flex-col bg-ink-100">
        <TopNav />
        <Routes>
          <Route path="/" element={<Navigate to="/workbench" replace />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/review" element={<Review />} />
          <Route path="*" element={<Navigate to="/workbench" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
