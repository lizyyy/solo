import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import TaskList from '@/pages/TaskList';
import TaskDetail from '@/pages/TaskDetail';
import PendingCenter from '@/pages/PendingCenter';
import ExportReview from '@/pages/ExportReview';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<TaskList />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/pending" element={<PendingCenter />} />
          <Route path="/export/:id" element={<ExportReview />} />
        </Routes>
      </Layout>
    </Router>
  );
}
