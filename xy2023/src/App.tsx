import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/common';
import { AppProvider } from '@/context/AppContext';

import Home from '@/pages/Home';
import ConstitutionTest from '@/pages/Constitution';
import FoodList from '@/pages/Food';
import { DiaryList, DiaryEditor } from '@/pages/Diary';
import ForecastPage from '@/pages/Forecast';
import { CheckInPage, PainRecordPage } from '@/pages/CheckIn';
import OutfitPage from '@/pages/Outfit';
import CommunityPage from '@/pages/Community';
import ProfilePage from '@/pages/Profile';

const AppContent: React.FC = () => {
  const location = useLocation();

  const showBottomNav = [
    '/',
    '/constitution',
    '/diary',
    '/community',
    '/profile'
  ].some(path => location.pathname === path || location.pathname.startsWith(path + '/'));

  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/constitution" element={<ConstitutionTest />} />
        <Route path="/constitution/result" element={<ConstitutionTest />} />
        <Route path="/food" element={<FoodList />} />
        <Route path="/diary" element={<DiaryList />} />
        <Route path="/diary/:id" element={<DiaryEditor />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/checkin" element={<CheckInPage />} />
        <Route path="/pain" element={<PainRecordPage />} />
        <Route path="/outfit" element={<OutfitPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      {showBottomNav && <BottomNav />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
