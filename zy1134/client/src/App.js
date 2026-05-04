import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { 
  BookOpen, 
  FileText, 
  TrendingUp, 
  Settings, 
  Music,
  Home
} from 'lucide-react';

// 页面组件
import HomePage from './pages/HomePage';
import PracticePage from './pages/PracticePage';
import WrongNotesPage from './pages/WrongNotesPage';
import ProgressPage from './pages/ProgressPage';
import ReportsPage from './pages/ReportsPage';

// 侧边栏组件
function Sidebar() {
  const [activeItem, setActiveItem] = useState('home');

  const menuItems = [
    { id: 'home', icon: Home, label: '首页', path: '/' },
    { id: 'practice', icon: Music, label: '练习', path: '/practice' },
    { id: 'wrong-notes', icon: FileText, label: '错题本', path: '/wrong-notes' },
    { id: 'progress', icon: TrendingUp, label: '进度看板', path: '/progress' },
    { id: 'reports', icon: BookOpen, label: '练习报告', path: '/reports' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">乐理练习台</h1>
            <p className="text-xs text-gray-500">Music Theory Practice</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  onClick={() => setActiveItem(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeItem === item.id
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3 text-gray-600">
          <Settings className="w-5 h-5" />
          <span className="text-sm">设置</span>
        </div>
      </div>
    </div>
  );
}

// 头部组件
function Header() {
  return (
    <header className="bg-white border-b border-gray-200 h-16 fixed top-0 left-64 right-0 z-10">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {window.location.pathname === '/' && '首页'}
            {window.location.pathname === '/practice' && '开始练习'}
            {window.location.pathname === '/wrong-notes' && '错题本'}
            {window.location.pathname === '/progress' && '进度看板'}
            {window.location.pathname === '/reports' && '练习报告'}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-medium text-sm">学</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">学生用户</p>
              <p className="text-xs text-gray-500">student@example.com</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// 布局组件
function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header />
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// 主应用组件
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout>
            <HomePage />
          </Layout>
        } />
        <Route path="/practice" element={
          <Layout>
            <PracticePage />
          </Layout>
        } />
        <Route path="/wrong-notes" element={
          <Layout>
            <WrongNotesPage />
          </Layout>
        } />
        <Route path="/progress" element={
          <Layout>
            <ProgressPage />
          </Layout>
        } />
        <Route path="/reports" element={
          <Layout>
            <ReportsPage />
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
