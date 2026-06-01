import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Params } from '@/pages/Params';
import { Calculation } from '@/pages/Calculation';
import { Samples } from '@/pages/Samples';
import { Charts } from '@/pages/Charts';
import { Report } from '@/pages/Report';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/params" element={<Params />} />
          <Route path="/calculation" element={<Calculation />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/report" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  );
}
