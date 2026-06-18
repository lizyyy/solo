import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import RecordDetail from '@/pages/RecordDetail';
import ComparePage from '@/pages/ComparePage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record/:id" element={<RecordDetail />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </Router>
  );
}
