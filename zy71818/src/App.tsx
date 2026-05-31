import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RecordList from './pages/RecordList';
import RecordDetail from './pages/RecordDetail';
import RecordForm from './pages/RecordForm';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecordList />} />
        <Route path="/record/new" element={<RecordForm />} />
        <Route path="/record/:id" element={<RecordDetail />} />
      </Routes>
    </Router>
  );
}
