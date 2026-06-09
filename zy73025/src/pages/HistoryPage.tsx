import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  PawPrint,
  Info,
  AlertTriangle,
  Circle,
  CircleDot,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import HistoryTimeline from '@/components/HistoryTimeline';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecord, history, historyLoading, recordLoading, fetchHistory, fetchRecord } =
    useAppStore();

  useEffect(() => {
    if (id) {
      fetchHistory(id);
      fetchRecord(id);
    }
  }, [id, fetchHistory, fetchRecord]);

  return (
    <div className="min-h-screen bg-mist-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => id && navigate(`/records/${id}`)}
            className="btn-ghost gap-1.5 px-3 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回详情
          </button>
          <nav className="flex items-center text-sm text-mist-500">
            <Link to="/" className="hover:text-forest-700 transition-colors">
              列表
            </Link>
            <ChevronRight className="w-4 h-4 mx-1 text-mist-300" />
            <Link
              to={`/records/${id}`}
              className="hover:text-forest-700 transition-colors"
            >
              记录详情
            </Link>
            <ChevronRight className="w-4 h-4 mx-1 text-mist-300" />
            <span className="text-mist-800 font-medium">历史追溯</span>
          </nav>
        </div>

        {currentRecord && (
          <div className="card mb-6 flex items-center gap-4 bg-gradient-to-r from-forest-50/50 to-white border-l-4 border-l-forest-700">
            <div className="w-12 h-12 rounded-xl bg-forest-700 flex items-center justify-center shrink-0">
              <PawPrint className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl font-bold text-mist-900">
                  {currentRecord.petName}
                </h1>
                <span className="text-xs text-mist-400 font-mono">
                  {currentRecord.code}
                </span>
              </div>
              <p className="text-sm text-mist-500 mt-0.5">
                {currentRecord.petType} · 主人 {currentRecord.ownerName} · 就诊{' '}
                {new Date(currentRecord.visitDate).toLocaleDateString('zh-CN')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-mist-400 uppercase tracking-wider mb-1">
                历史节点
              </p>
              <p className="font-serif text-3xl font-bold text-forest-700">
                {history.length}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-6">
          <div>
            {historyLoading ? (
              <div className="card">
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-mist-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-mist-200 rounded w-1/3" />
                        <div className="h-4 bg-mist-100 rounded w-3/4" />
                        <div className="h-16 bg-mist-100 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <HistoryTimeline history={history} />
            )}
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className="card">
              <h3 className="section-title flex items-center gap-2">
                <Info className="w-4 h-4 text-forest-700" />
                图例说明
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-forest-50 border border-forest-200">
                  <div className="w-9 h-9 rounded-full bg-forest-500 flex items-center justify-center shrink-0 ring-2 ring-forest-100">
                    <CircleDot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-forest-800">
                      🟢 绿色节点
                    </p>
                    <p className="text-xs text-forest-600 mt-0.5">
                      系统自动创建 / 系统自动处理
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shrink-0 ring-2 ring-amber-100">
                    <Circle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      🟠 琥珀色节点
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      人工修改（改判 / 补录 / 异常确认）
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-mist-200">
                  <div
                    className={cn(
                      'flex items-start gap-2 p-3 rounded-lg',
                      'bg-amber-50 border border-amber-300',
                    )}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800 mb-1">
                        评审会查阅提示
                      </p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        时间线中所有的
                        <span className="font-bold px-1 mx-0.5 bg-amber-200 text-amber-900 rounded">
                          琥珀色节点
                        </span>
                        即是被人工改过的步骤，点击可展开版本对比，查看具体变更内容。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="section-title">操作统计</h3>
              <div className="space-y-2.5">
                <StatBar
                  label="系统操作"
                  count={history.filter((h) => !h.isManual).length}
                  total={history.length}
                  color="bg-forest-500"
                />
                <StatBar
                  label="人工操作"
                  count={history.filter((h) => h.isManual).length}
                  total={history.length}
                  color="bg-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-mist-600">{label}</span>
        <span className="font-semibold text-mist-800">{count}</span>
      </div>
      <div className="h-2 bg-mist-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
