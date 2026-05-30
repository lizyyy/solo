import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TrainingPage from './pages/TrainingPage';
import RecordListPage from './pages/RecordListPage';
import ReviewPage from './pages/ReviewPage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/training/:scenarioId" element={<TrainingPage />} />
        <Route path="/records" element={<RecordListPage />} />
        <Route path="/review/:recordId" element={<ReviewPage />} />
      </Routes>
    </Router>
  );
};

export default App;
