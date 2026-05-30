import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card text-center max-w-md">
        <AlertCircle className="mx-auto text-accent-warning mb-4" size={64} />
        <h1 className="text-4xl font-bold mb-2 timecode">404</h1>
        <p className="text-xl font-medium mb-2">页面未找到</p>
        <p className="text-text-muted mb-6">
          您访问的页面不存在，或已被移动到其他位置。
        </p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <Home size={16} />
          返回首页
        </Link>
      </div>
    </div>
  );
};
