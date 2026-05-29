import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Workspace from '@/pages/Workspace';
import Preview from '@/pages/Preview';
import History from '@/pages/History';
import Report from '@/pages/Report';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Workspace />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/history" element={<History />} />
          <Route path="/report" element={<Report />} />
          <Route path="*" element={<Workspace />} />
        </Route>
      </Routes>
    </Router>
  );
}
