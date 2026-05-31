import { FileText } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const isDetailPage = location.pathname.startsWith('/record/');

  return (
    <header className="bg-primary-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold tracking-wide">
                私募投资者回访留痕
              </h1>
              <p className="text-primary-200 text-sm">门店财务对账工具</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isDetailPage && (
              <Link
                to="/"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
              >
                ← 返回列表
              </Link>
            )}
            <div className="text-sm text-primary-200">
              当前用户：<span className="text-white font-medium">老曹</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
