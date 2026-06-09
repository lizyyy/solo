import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TrackList from '@/pages/TrackList';
import TrackDetail from '@/pages/TrackDetail';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/tracks" replace />} />
        <Route path="/tracks" element={<TrackList />} />
        <Route path="/tracks/:id" element={<TrackDetail />} />
      </Routes>
    </Router>
  );
}
