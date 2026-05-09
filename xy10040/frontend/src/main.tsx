import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Home } from './pages/Home';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900">活动报名系统</h1>
              </div>
              <div className="text-sm text-gray-500">
                Event Registration System
              </div>
            </div>
          </div>
        </header>
        <main className="py-8 px-4">
          <Home />
        </main>
        <footer className="bg-white border-t mt-auto">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="text-center text-sm text-gray-500">
              <p>活动报名系统 - 数据一致性优先</p>
              <p className="mt-1">
                支持: 幂等性Token | 乐观锁 | 分布式锁 | 事件溯源 | 事务回滚
              </p>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
