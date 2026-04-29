import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, MessageCircle, Users, User } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import HomePage from '@/pages/HomePage';
import PracticePage from '@/pages/PracticePage';
import ChatPracticePage from '@/pages/ChatPracticePage';
import EmergencyPage from '@/pages/EmergencyPage';
import AICoachPage from '@/pages/AICoachPage';
import CommunityPage from '@/pages/CommunityPage';
import DiaryPage from '@/pages/DiaryPage';
import PlantPage from '@/pages/PlantPage';
import ProfilePage from '@/pages/ProfilePage';
import TestPage from '@/pages/TestPage';
import ChatSessionPage from '@/pages/ChatSessionPage';
import CreatePostPage from '@/pages/CreatePostPage';
import CreateDiaryPage from '@/pages/CreateDiaryPage';
import CreateTreeHolePage from '@/pages/CreateTreeHolePage';
import PosterPage from '@/pages/PosterPage';

const navItems = [
  { id: 'home', label: '首页', icon: Home, path: '/' },
  { id: 'practice', label: '练习', icon: BookOpen, path: '/practice' },
  { id: 'chat', label: '聊天', icon: MessageCircle, path: '/chat' },
  { id: 'community', label: '社区', icon: Users, path: '/community' },
  { id: 'profile', label: '我的', icon: User, path: '/profile' },
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useAppStore();
  
  const hiddenPaths = [
    '/test', '/chat/session', '/community/post', '/diary/create', 
    '/hole/create', '/poster', '/emergency', '/ai-coach', '/plant'
  ];
  
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) {
    return null;
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-i-500' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-i-50 to-e-50">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/chat" element={<ChatPracticePage />} />
        <Route path="/chat/session" element={<ChatSessionPage />} />
        <Route path="/emergency" element={<EmergencyPage />} />
        <Route path="/ai-coach" element={<AICoachPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/community/post" element={<CreatePostPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/diary/create" element={<CreateDiaryPage />} />
        <Route path="/hole/create" element={<CreateTreeHolePage />} />
        <Route path="/plant" element={<PlantPage />} />
        <Route path="/poster" element={<PosterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
