import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import SetlistList from '@/pages/SetlistList';
import SetlistDetail from '@/pages/SetlistDetail';
import Report from '@/pages/Report';
import ApiDocs from '@/pages/ApiDocs';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<SetlistList />} />
          <Route path="/docs" element={<ApiDocs />} />
          <Route path="/setlist/:id" element={<SetlistDetail />} />
          <Route path="/setlist/:id/report" element={<Report />} />
        </Routes>
      </Layout>
    </Router>
  );
}
