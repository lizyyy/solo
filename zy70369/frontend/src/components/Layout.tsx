import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Users, Download, Settings } from 'lucide-react';
import { operatorApi, Operator } from '../services/api';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<string>('');

  useEffect(() => {
    operatorApi.getList().then(setOperators);
  }, []);

  useEffect(() => {
    if (operators.length > 0 && !selectedOperator) {
      setSelectedOperator(operators[0].id);
    }
  }, [operators, selectedOperator]);

  useEffect(() => {
    if (selectedOperator) {
      localStorage.setItem('currentOperatorId', selectedOperator);
    }
  }, [selectedOperator]);

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">仲裁台</h1>
              <p className="text-xs text-gray-500">异常订单处理</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/exceptions"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/exceptions')
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span>异常订单</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-2">
              <Users className="w-4 h-4" />
              当前操作员
            </label>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">异常订单人工仲裁台</h2>
            <p className="text-sm text-gray-500 mt-1">处理支付成功但库存失败、物流取消、优惠异常等订单</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (location.pathname === '/exceptions') {
                  window.open('/api/export/arbitration/csv', '_blank');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出记录
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto scrollbar-thin">
          {children}
        </div>
      </main>
    </div>
  );
}
