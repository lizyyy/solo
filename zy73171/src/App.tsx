import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import Home from '@/pages/Home';
import Params from '@/pages/Params';
import Samples from '@/pages/Samples';
import Review from '@/pages/Review';
import Exceptions from '@/pages/Exceptions';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/params" element={<Params />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/review" element={<Review />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </Router>
  );
}
