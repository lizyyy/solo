import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';

export default function SupplementRecord() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecord, loading, saveStatus, fetchRecord, supplementRecord, clearSaveStatus } = useRecordStore();
  
  const [oldChannelInfo, setOldChannelInfo] = useState('');

  useEffect(() => {
    if (id) {
      fetchRecord(id);
    }
    return () => clearSaveStatus();
  }, [id, fetchRecord, clearSaveStatus]);

  const handleSupplement = () => {
    if (id && oldChannelInfo.trim()) {
      supplementRecord(id, oldChannelInfo.trim());
    }
  };

  if (loading && !currentRecord) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="animate-pulse-soft text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-slate-800 text-white py-6 mb-8">
        <div className="container max-w-3xl px-4">
          <button
            onClick={() => navigate(`/record/${id}`)}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            返回详情
          </button>
          <h1 className="font-display text-2xl font-semibold">补充舞台通道表材料</h1>
          {currentRecord && (
            <p className="text-slate-300 text-sm mt-1">
              {currentRecord.trackName} · {currentRecord.artistName}
            </p>
          )}
        </div>
      </header>

      <main className="container max-w-3xl px-4 pb-12">
        <div className="card animate-fade-in-up">
          <h2 className="font-display text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FileText size={18} />
            舞台通道表旧口径信息
          </h2>
          
          <p className="text-sm text-slate-500 mb-4">
            从历史舞台通道表中找到的旧口径记录，补充到当前记录的备注中。
            补充后来源将自动标记为"导入旧记录"。
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-2">通道表旧口径内容</label>
              <textarea
                value={oldChannelInfo}
                onChange={(e) => setOldChannelInfo(e.target.value)}
                className="input-field h-48 resize-none"
                placeholder="粘贴舞台通道表中的历史记录信息..."
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-warm-200">
              <div>
                {saveStatus === 'saving' && (
                  <span className="text-sm text-amber-600 animate-pulse-soft">保存中...</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-sm text-green-600">补充成功！</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/record/${id}`)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleSupplement}
                  disabled={!oldChannelInfo.trim() || saveStatus === 'saving'}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save size={16} />
                  补充材料
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
