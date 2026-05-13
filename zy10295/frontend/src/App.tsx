import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TireList from './pages/TireList';
import TireDetail from './pages/TireDetail';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tires" element={<TireList />} />
          <Route path="/tires/:id" element={<TireDetail />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
