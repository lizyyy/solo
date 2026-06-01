import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Play, FileText, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { formatCurrency, formatPercent, formatDateTime, getReturnColor } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';

export default function HistoryList() {
  const navigate = useNavigate();
  const { records, loadRecords, deleteRecord, clearAll, loadSampleData } = useHistoryStore();

  useEffect(() => {
    loadRecords();
    loadSampleData();
  }, [loadRecords, loadSampleData]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这条记录吗？')) {
      deleteRecord(id);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      clearAll();
    }
  };

  const handleViewReplay = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/history/${id}`);
  };

  const handleViewReport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/report/${id}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-serif text-xl font-bold text-neutral-800">历史记录</h1>
              <p className="text-xs text-neutral-500">查看所有对局的历史数据和报告</p>
            </div>
          </div>
          {records.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn-danger text-sm"
            >
              清空记录
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {records.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={64} className="mx-auto text-neutral-300 mb-4" />
            <h3 className="font-serif text-xl font-semibold text-neutral-600 mb-2">暂无历史记录</h3>
            <p className="text-neutral-500 mb-6">完成一局对局后，记录将保存在这里</p>
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              开始一局
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/report/${record.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-serif font-semibold text-lg">{record.configName}</h3>
                      <StatusBadge status="settled" type="game" />
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-neutral-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDateTime(record.startTime)}
                      </span>
                      <span>共 {record.totalRounds} 回合</span>
                      <span>初始资金 {formatCurrency(record.initialCapital)}</span>
                      <span>最终资金 {formatCurrency(record.finalCapital)}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        {record.totalReturnPercent >= 0 ? (
                          <TrendingUp size={18} className="text-success-500" />
                        ) : (
                          <TrendingDown size={18} className="text-danger-500" />
                        )}
                        <span className={`font-mono font-bold text-lg ${getReturnColor(record.totalReturnPercent)}`}>
                          {formatCurrency(record.totalReturn)} ({formatPercent(record.totalReturnPercent)})
                        </span>
                      </div>
                      <div className="text-sm text-neutral-500">
                        胜率：{formatPercent(record.settlement.winRate)}
                      </div>
                      <div className="text-sm text-neutral-500">
                        最大回撤：{formatPercent(record.settlement.maxDrawdown)}
                      </div>
                      <div className="text-sm text-neutral-500">
                        交易次数：{record.settlement.tradeCount}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-6">
                    <button
                      onClick={(e) => handleViewReplay(record.id, e)}
                      className="btn-secondary text-sm flex items-center gap-1"
                    >
                      <Play size={16} />
                      回放
                    </button>
                    <button
                      onClick={(e) => handleViewReport(record.id, e)}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <FileText size={16} />
                      报告
                    </button>
                    <button
                      onClick={(e) => handleDelete(record.id, e)}
                      className="p-2 text-neutral-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
