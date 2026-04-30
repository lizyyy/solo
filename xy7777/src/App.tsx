import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { RoadmapPage } from './pages/RoadmapPage';
import { TasksPage } from './pages/TasksPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { ProgressPage } from './pages/ProgressPage';

function AppContent() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/dictionary" element={<DictionaryPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </Router>
  );
}

export default App;
