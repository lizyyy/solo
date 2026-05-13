import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ExceptionList from './pages/ExceptionList';
import ExceptionDetail from './pages/ExceptionDetail';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/exceptions" replace />} />
        <Route path="/exceptions" element={<ExceptionList />} />
        <Route path="/exceptions/:id" element={<ExceptionDetail />} />
      </Routes>
    </Layout>
  );
}

export default App;
