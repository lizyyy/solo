import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import TaskList from '@/pages/TaskList';
import TaskDetail from '@/pages/TaskDetail';
import History from '@/pages/History';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<TaskList />} />
          <Route path="/task/:id" element={<TaskDetail />} />
          <Route path="/task/:id/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  );
}
