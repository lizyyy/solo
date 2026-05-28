import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StartPage } from './pages/StartPage';
import { GamePage } from './pages/GamePage';
import { ReportPage } from './pages/ReportPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/report/:reportId" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
