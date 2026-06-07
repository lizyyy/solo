import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, AlertTriangle, FileText, Users } from 'lucide-react';
import { useRecordStore } from '@/stores/useRecordStore';

export default function ConflictPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecord, loading, fetchById, confirmConflict, rejectConflict } = useRecordStore();
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (id) {
      fetchById(id);
    }
    return () => {
      useRecordStore.getState().clearCurrent();
    };
  }, [id, fetchById]);

  const handleConfirm = async () => {
    if (!id || !resolution.trim()) return;
    await confirmConflict(id, resolution);
    navigate(`/record/${id}`);
  };

  const handleReject = async () => {
    if (!id || !resolution.trim()) return;
    await rejectConflict(id, resolution);
    navigate(`/record/${id}`);
  };

  if (loading && !currentRecord) {
    return <div className="text-center py-12 text-slate-500">加载中...</div>;
  }

  if (!currentRecord) {
    return <div className="text-center py-12 text-slate-500">记录不存在</div>;
  }

  const isHandled = currentRecord.conflictStatus === 'confirmed' || currentRecord.conflictStatus === 'rejected';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/record/${id}`} className="p-2 hover:bg-slate-100 rounded">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900">冲突处理</h2>
          <p className="text-sm text-slate-500">红线图编号：{currentRecord.redLineNo}</p>
        </div>
      </div>

      {isHandled && (
        <div
          className={`p-4 rounded-lg border ${
            currentRecord.conflictStatus === 'confirmed'
              ? 'bg-success-50 border-success-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {currentRecord.conflictStatus === 'confirmed' ? (
              <Check className="w-5 h-5 text-success-600" />
            ) : (
              <X className="w-5 h-5 text-slate-600" />
            )}
            <span className="font-medium">
              此冲突已{currentRecord.conflictStatus === 'confirmed' ? '确认' : '驳回'}
            </span>
          </div>
          {currentRecord.conflictResolution && (
            <p className="mt-2 text-sm text-slate-600">处理意见：{currentRecord.conflictResolution}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <FileText className="w-5 h-5 text-municipal-600" />
            <h3 className="font-semibold text-slate-900">红线图备注</h3>
          </div>
          <div className="remark-text max-h-80 overflow-auto">{currentRecord.redLineRemark}</div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Users className="w-5 h-5 text-municipal-600" />
            <h3 className="font-semibold text-slate-900">网格员巡查表</h3>
          </div>
          <div className="remark-text max-h-80 overflow-auto">{currentRecord.gridInspection || '（未填写）'}</div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
          <AlertTriangle className="w-5 h-5 text-warning-500" />
          <h3 className="font-semibold text-slate-900">冲突证据列表</h3>
        </div>

        {currentRecord.conflictPoints && currentRecord.conflictPoints.length > 0 ? (
          <div className="space-y-4">
            {currentRecord.conflictPoints.map((cp, idx) => (
              <div key={idx} className="border border-warning-200 rounded-lg overflow-hidden">
                <div className="bg-warning-50 px-4 py-2 border-b border-warning-200">
                  <span className="font-medium text-warning-800 text-sm">
                    冲突 {idx + 1}：{cp.field}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">红线图值</div>
                      <div className="p-2 bg-warning-50 rounded text-sm font-mono">{cp.redLineValue}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">网格员值</div>
                      <div className="p-2 bg-municipal-50 rounded text-sm font-mono">{cp.gridValue}</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
                    <span className="font-medium">说明：</span>
                    {cp.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">未检测到冲突</div>
        )}
      </div>

      {!isHandled && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">处理操作</h3>
          <p className="text-sm text-slate-500">
            系统不自动处理冲突，请市政巡检员小付人工判断后选择确认或驳回。
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              处理意见 <span className="text-danger-500">*</span>
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="请填写处理意见，说明确认或驳回的理由..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={handleReject}
              className="btn-danger flex items-center gap-2"
              disabled={loading || !resolution.trim()}
            >
              <X className="w-4 h-4" />
              驳回冲突
            </button>
            <button
              onClick={handleConfirm}
              className="btn-success flex items-center gap-2"
              disabled={loading || !resolution.trim()}
            >
              <Check className="w-4 h-4" />
              确认冲突
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
