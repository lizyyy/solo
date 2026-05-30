import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import Home from '@/pages/Home';
import RequirementDetail from '@/pages/RequirementDetail';
import Channels from '@/pages/Channels';
import Monitors from '@/pages/Monitors';
import Schedule from '@/pages/Schedule';
import Export from '@/pages/Export';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/requirement/new" element={<RequirementDetail />} />
          <Route path="/requirement/:id" element={<RequirementDetail />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/monitors" element={<Monitors />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/export" element={<Export />} />
        </Route>
      </Routes>
    </Router>
  );
}
