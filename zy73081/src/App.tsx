import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CollisionListPage from '@/pages/CollisionListPage';
import CollisionDetailPage from '@/pages/CollisionDetailPage';
import { Toast } from '@/components/Toast';
import { initializeStorage } from '@/services/storage';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    initializeStorage();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/collisions" replace />} />
        <Route path="/collisions" element={<CollisionListPage />} />
        <Route path="/collisions/:id" element={<CollisionDetailPage />} />
        <Route path="*" element={<Navigate to="/collisions" replace />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  );
}
