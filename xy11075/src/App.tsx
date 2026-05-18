import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RecordList from './pages/RecordList';
import RecordDetail from './pages/RecordDetail';
import RecordForm from './pages/RecordForm';
import Reports from './pages/Reports';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<RecordList />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/create" element={<RecordForm />} />
          <Route path="/edit/:id" element={<RecordForm />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
