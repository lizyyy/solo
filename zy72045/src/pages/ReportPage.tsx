import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Home } from 'lucide-react';
import { ReportSummary } from '../components/report/ReportSummary';
import { DetailTable } from '../components/report/DetailTable';
import { useHistoryStore } from '../store/useHistoryStore';

export default function ReportPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { loadRecordById, currentRecord } = useHistoryStore();

  useEffect(() => {
    if (id) {
      loadRecordById(id);
    }
  }, [id, loadRecordById]);

  if (!currentRecord) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">未找到该报告</p>
          <button onClick={() => navigate('/history')} className="btn-primary">
            返回历史记录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/history')}
              className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-serif text-xl font-bold text-neutral-800">对局报告</h1>
              <p className="text-xs text-neutral-500">报告与明细数据同源，确保口径一致</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/history/${currentRecord.id}`)}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Play size={16} />
              回放对局
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-primary text-sm flex items-center gap-1"
            >
              <Home size={16} />
              开始新局
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="space-y-6">
          <ReportSummary record={currentRecord} />
          <DetailTable record={currentRecord} />
        </div>
      </main>
    </div>
  );
}
