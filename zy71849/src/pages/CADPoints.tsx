import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store';
import { PenTool, AlertTriangle, User, Clock, RefreshCw, CheckCircle2, UserCheck, ArrowRight, Search } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import TraceSidebar from '@/components/TraceSidebar';
import { FLIP_TYPE_LABELS, FLIP_SOURCE_LABELS } from '@/types';
import { getNextStepForFlip, resolveFlipRecord } from '@/utils/flipDetector';

export default function CADPoints() {
  const { id } = useParams();
  const { cadPoints, flipRecords, loadProjectData, selectedRecord, currentUser } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFlipOnly, setShowFlipOnly] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  useEffect(() => {
    if (id) {
      loadProjectData(id);
    }
  }, [id, loadProjectData]);

  const filteredPoints = cadPoints.filter((p) => {
    const matchesSearch =
      p.pointCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pointName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFlip = !showFlipOnly || p.hasFlip;
    return matchesSearch && matchesFlip;
  });

  const pendingFlips = flipRecords.filter((f) => f.status === 'pending');

  const handleResolve = async (flipId: string) => {
    if (!resolveNote.trim()) {
      alert('请填写处理备注');
      return;
    }
    await resolveFlipRecord(flipId, currentUser, resolveNote);
    setResolvingId(null);
    setResolveNote('');
    if (id) {
      loadProjectData(id);
    }
  };

  if (!id) return null;

  return (
    <div className="p-8 relative">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-serif text-2xl font-semibold text-slate-800 flex items-center gap-3">
            <PenTool className="w-6 h-6 text-purple-600" />
            CAD点位
          </h1>
          <div className="flex items-center gap-3">
            {pendingFlips.length > 0 && (
              <span className="badge badge-flip flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {pendingFlips.length} 条翻转待处理
              </span>
            )}
            <span className="badge bg-purple-100 text-purple-700">
              共 {cadPoints.length} 条记录
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-500">管理CAD坐标点位，自动检测坐标轴翻转</p>
      </div>

      {pendingFlips.length > 0 && (
        <div className="card border-purple-200 bg-purple-50/30 mb-6">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-purple-800">坐标轴翻转提醒</h3>
                <p className="text-sm text-purple-700 mt-1">
                  检测到 {pendingFlips.length} 条坐标轴翻转记录，请及时联系对应责任人处理。
                  翻转数据会影响视线分析结果的准确性。
                </p>
              </div>
              <button
                onClick={() => setShowFlipOnly(!showFlipOnly)}
                className="btn btn-primary text-sm flex items-center gap-1"
              >
                {showFlipOnly ? '显示全部' : '仅显示翻转'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索点位编号或名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>点位编号</th>
                <th>点位名称</th>
                <th>坐标 (X, Y, Z)</th>
                <th>来源</th>
                <th>翻转状态</th>
                <th>导入人</th>
                <th>导入时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPoints.map((point) => {
                const flipRecord = flipRecords.find(
                  (f) => f.cadPointId === point.id && f.status === 'pending'
                );
                const nextStep = point.hasFlip && point.flipSource
                  ? getNextStepForFlip(point.flipSource)
                  : null;

                return (
                  <>
                    <tr
                      key={point.id}
                      className={point.hasFlip ? 'bg-purple-50/50 animate-shake' : ''}
                    >
                      <td className="font-mono text-sm text-purple-700">{point.pointCode}</td>
                      <td>{point.pointName}</td>
                      <td className="font-mono text-xs">
                        <span className={point.hasFlip ? 'text-purple-600 font-medium' : ''}>
                          {point.x}, {point.y}, {point.z}
                        </span>
                      </td>
                      <td className="text-sm text-slate-600">{point.source}</td>
                      <td>
                        {point.hasFlip ? (
                          <div>
                            <StatusBadge status={point.flipType || 'none'} type="flip" />
                            {point.flipSource && (
                              <p className="text-xs text-purple-600 mt-1">
                                来源：{FLIP_SOURCE_LABELS[point.flipSource]}
                              </p>
                            )}
                          </div>
                        ) : (
                          <StatusBadge status="none" type="flip" />
                        )}
                      </td>
                      <td className="flex items-center gap-1.5 text-sm text-slate-600">
                        <User className="w-3.5 h-3.5" />
                        {point.importer}
                      </td>
                      <td className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(point.importedAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td>
                        {flipRecord && (
                          <button
                            onClick={() => setResolvingId(flipRecord.id)}
                            className="btn btn-primary text-xs flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            处理
                          </button>
                        )}
                        {!flipRecord && point.hasFlip && (
                          <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            已处理
                          </span>
                        )}
                      </td>
                    </tr>

                    {resolvingId === flipRecord?.id && (
                      <tr className="bg-purple-50/30">
                        <td colSpan={8} className="p-4">
                          <div className="max-w-2xl">
                            <div className="bg-white rounded-lg border border-purple-200 p-4 mb-4">
                              <h4 className="font-medium text-purple-800 mb-2">翻转详情</h4>
                              <p className="text-sm text-purple-700 mb-2">
                                <span className="font-medium">翻转类型：</span>
                                {point.flipType ? FLIP_TYPE_LABELS[point.flipType] : '未知'}
                              </p>
                              <p className="text-sm text-purple-700 mb-2">
                                <span className="font-medium">问题来源：</span>
                                {point.flipSource ? FLIP_SOURCE_LABELS[point.flipSource] : '未知'}
                              </p>
                              {nextStep && (
                                <>
                                  <p className="text-sm text-purple-700 mb-1">
                                    <span className="font-medium">下一步操作：</span>
                                  </p>
                                  <p className="text-sm text-purple-600 bg-purple-50 p-2 rounded">
                                    {nextStep.step}
                                  </p>
                                  <p className="text-sm text-purple-700 mt-2">
                                    <span className="font-medium">联系人：</span>
                                    {nextStep.contact}（{nextStep.role}）
                                  </p>
                                </>
                              )}
                              <p className="text-sm text-purple-600 mt-2">
                                <span className="font-medium">备注：</span>
                                {flipRecord.remark}
                              </p>
                            </div>

                            <label className="label">处理备注 *</label>
                            <textarea
                              value={resolveNote}
                              onChange={(e) => setResolveNote(e.target.value)}
                              placeholder="请说明处理方式和结果..."
                              className="input"
                              rows={2}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              当前操作人：{currentUser}
                            </p>
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => handleResolve(flipRecord.id)}
                                className="btn btn-success text-sm flex items-center gap-1"
                              >
                                <UserCheck className="w-4 h-4" />
                                标记为已解决
                              </button>
                              <button
                                onClick={() => {
                                  setResolvingId(null);
                                  setResolveNote('');
                                }}
                                className="btn btn-secondary text-sm"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPoints.length === 0 && (
        <div className="text-center py-16">
          <PenTool className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无匹配的CAD点位</p>
        </div>
      )}

      {selectedRecord && <TraceSidebar />}
    </div>
  );
}
