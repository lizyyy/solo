import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
      <div className="text-center">
        <FileQuestion className="w-20 h-20 text-neutral-300 mx-auto mb-6" />
        <h1 className="text-4xl font-serif font-bold text-neutral-900 mb-2">404</h1>
        <p className="text-lg text-neutral-600 mb-6">页面不存在或记录已被删除</p>
        <button
          className="btn btn-primary inline-flex items-center gap-2"
          onClick={() => navigate('/list')}
        >
          <ArrowLeft size={16} />
          返回清分列表
        </button>
      </div>
    </div>
  );
}
