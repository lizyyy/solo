import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import NoiseCollection from '@/pages/NoiseCollection';
import CourseAssociation from '@/pages/CourseAssociation';
import ProcessingStatusPage from '@/pages/ProcessingStatus';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<NoiseCollection />} />
          <Route path="/association" element={<CourseAssociation />} />
          <Route path="/status" element={<ProcessingStatusPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
