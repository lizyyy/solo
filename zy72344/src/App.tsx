import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Parameters from '@/pages/Parameters';
import Answers from '@/pages/Answers';
import AnswerDetail from '@/pages/AnswerDetail';
import Visualization from '@/pages/Visualization';
import History from '@/pages/History';
import Reports from '@/pages/Reports';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/parameters" element={<Parameters />} />
          <Route path="/answers" element={<Answers />} />
          <Route path="/answers/:id" element={<AnswerDetail />} />
          <Route path="/visualization" element={<Visualization />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}
