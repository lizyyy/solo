import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import VersionCompare from './pages/VersionCompare';
import ConfirmedProposals from './pages/ConfirmedProposals';

const App = () => {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/versions/compare" element={<VersionCompare />} />
        <Route path="/confirmed-proposals" element={<ConfirmedProposals />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Layout>
  );
};

export default App;
