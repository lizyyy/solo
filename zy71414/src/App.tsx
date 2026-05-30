import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ApplicationList } from './pages/ApplicationList';
import { ApplicationDetail } from './pages/ApplicationDetail';
import { ApplicationForm } from './pages/ApplicationForm';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ApplicationList />} />
          <Route path="/application/new" element={<ApplicationForm />} />
          <Route path="/application/:id" element={<ApplicationDetail />} />
          <Route path="/application/:id/edit" element={<ApplicationForm />} />
        </Route>
      </Routes>
    </Router>
  );
}
