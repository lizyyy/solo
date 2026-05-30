import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertTriangle size={48} className="text-red-400" />
        </div>
        <h1 className="text-6xl font-bold font-mono text-gray-700 mb-2">404</h1>
        <p className="text-xl text-gray-400 font-mono mb-2">页面未找到</p>
        <p className="text-sm text-gray-500 font-mono mb-8">
          弹珠飞入了未知的轨道...
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-mono font-bold rounded-lg transition-all active:scale-95"
        >
          <Home size={18} />
          返回首页
        </button>
      </div>
    </div>
  );
};
