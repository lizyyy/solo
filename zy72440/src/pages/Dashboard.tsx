import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  FileText,
  Play,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { useInventoryStore } from '@/store/inventoryStore';
import { RecordCard } from '@/components/common/RecordCard';

export function Dashboard() {
  const navigate = useNavigate();
  const { records, loadDemoData, getStatistics, getPendingReviewRecords, getSupplementaryRecords } = useInventoryStore();
  const stats = getStatistics();
  const pendingRecords = getPendingReviewRecords();
  const supplementaryRecords = getSupplementaryRecords();

  useEffect(() => {
    if (records.length === 0) {
      loadDemoData();
    }
  }, [records.length, loadDemoData]);

  const statCards = [
    { 
      label: '正常记录', 
      value: stats.normal + stats.completed, 
      icon: CheckCircle2, 
      color: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50',
      textColor: 'text-emerald-700'
    },
    { 
      label: '待店长复核', 
      value: stats.pendingReview, 
      icon: AlertTriangle, 
      color: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50',
      textColor: 'text-amber-700'
    },
    { 
      label: '补录返工', 
      value: stats.supplementary, 
      icon: RefreshCw, 
      color: 'from-purple-500 to-violet-600',
      bgLight: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    { 
      label: '已生成核销单', 
      value: stats.completed, 
      icon: FileText, 
      color: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-700'
    }
  ];

  return (
    <div className="space-y-8">
      {!useInventoryStore.getState().useDemoData && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">欢迎使用艺人周边库存联动系统</h3>
              <p className="text-blue-100 mb-4">为了让您快速了解系统，我们准备了演示数据</p>
              <button
                onClick={loadDemoData}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
              >
                <Play className="w-5 h-5" />
                加载演示数据
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="hidden md:block">
              <TrendingUp className="w-32 h-32 text-white/20" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-slate-800">{card.value}</span>
              </div>
              <p className={`text-sm font-medium ${card.textColor}`}>{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {pendingRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                待店长复核
              </h3>
              <button
                onClick={() => navigate('/review')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                查看全部 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {pendingRecords.slice(0, 2).map(record => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          </div>
        )}

        {supplementaryRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-purple-500" />
                补录返工中
              </h3>
              <button
                onClick={() => navigate('/records')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                查看全部 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {supplementaryRecords.slice(0, 2).map(record => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4">快捷操作</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/demo')}
            className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 hover:border-blue-300 transition-all text-left group"
          >
            <Play className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-medium text-slate-800 group-hover:text-blue-700">查看演示</p>
            <p className="text-xs text-slate-500">三种典型流程</p>
          </button>
          <button
            onClick={() => navigate('/records')}
            className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 hover:border-emerald-300 transition-all text-left group"
          >
            <FileText className="w-6 h-6 text-emerald-600 mb-2" />
            <p className="font-medium text-slate-800 group-hover:text-emerald-700">查看记录</p>
            <p className="text-xs text-slate-500">所有库存联动</p>
          </button>
          <button
            onClick={() => navigate('/review')}
            className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 hover:border-amber-300 transition-all text-left group"
          >
            <AlertTriangle className="w-6 h-6 text-amber-600 mb-2" />
            <p className="font-medium text-slate-800 group-hover:text-amber-700">店长复核</p>
            <p className="text-xs text-slate-500">异常记录处理</p>
          </button>
          <button
            onClick={() => navigate('/verification')}
            className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 hover:border-purple-300 transition-all text-left group"
          >
            <CheckCircle2 className="w-6 h-6 text-purple-600 mb-2" />
            <p className="font-medium text-slate-800 group-hover:text-purple-700">核销单对账</p>
            <p className="text-xs text-slate-500">课时核销核对</p>
          </button>
        </div>
      </div>
    </div>
  );
}
