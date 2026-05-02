import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout/Layout';
import { QuestionBank } from './pages/QuestionBank/QuestionBank';
import { QuestionDetail } from './pages/QuestionDetail/QuestionDetail';
import { ReviewPlan } from './pages/ReviewPlan/ReviewPlan';
import { MindMapPage } from './pages/MindMap/MindMap';
import { Profile } from './pages/Profile/Profile';

const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<QuestionBank />} />
            <Route path="/question/:questionId" element={<QuestionDetail />} />
            <Route path="/review" element={<ReviewPlan />} />
            <Route path="/mindmap" element={<MindMapPage />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
