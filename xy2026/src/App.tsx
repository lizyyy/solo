import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import HealingSquarePage from './pages/HealingSquarePage';
import DiaryPage from './pages/DiaryPage';
import MeditationPage from './pages/MeditationPage';
import ProfilePage from './pages/ProfilePage';
import MusicTherapyPage from './pages/MusicTherapyPage';
import DanceTherapyPage from './pages/DanceTherapyPage';
import PaintingTherapyPage from './pages/PaintingTherapyPage';
import EmotionToolsPage from './pages/EmotionToolsPage';
import CommunityPage from './pages/CommunityPage';
import DrawingCanvasPage from './pages/DrawingCanvasPage';
import ArtworkGalleryPage from './pages/ArtworkGalleryPage';
import TestPage from './pages/TestPage';
import TestResultPage from './pages/TestResultPage';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="app-container">
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/healing-square" element={<HealingSquarePage />} />
              <Route path="/diary" element={<DiaryPage />} />
              <Route path="/meditation" element={<MeditationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/music-therapy" element={<MusicTherapyPage />} />
              <Route path="/dance-therapy" element={<DanceTherapyPage />} />
              <Route path="/painting-therapy" element={<PaintingTherapyPage />} />
              <Route path="/emotion-tools" element={<EmotionToolsPage />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/drawing-canvas" element={<DrawingCanvasPage />} />
              <Route path="/artwork-gallery" element={<ArtworkGalleryPage />} />
              <Route path="/test/:testId" element={<TestPage />} />
              <Route path="/test-result/:resultId" element={<TestResultPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
