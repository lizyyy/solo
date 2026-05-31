import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import StatusBadge from '../components/StatusBadge';
import ChangeTypeBadge from '../components/ChangeTypeBadge';
import Timeline from '../components/Timeline';
import CoordinatePlot from '../components/CoordinatePlot';
import { formatDateTime, getStatusColor, simplifyNumber } from '../utils/format';
import { ArrowLeft, FlipHorizontal, FlipVertical, Maximize2, AlertTriangle, CheckCircle, Edit3 } from 'lucide-react';
import type { ChangeType, InspectionStatus } from '../../../shared/types';

export default function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inspections, settings, loading, error, performFlip, updateInspectionStatus, addChangeRecord, fetchInspections } = useStore();
  const [showFlipDialog, setShowFlipDialog] = useState(false);
  const [flipType, setFlipType] = useState<'x' | 'y' | 'origin'>('origin');
  const [showAddChangeDialog, setShowAddChangeDialog] = useState(false);
  const [newChange, setNewChange] = useState({
    type: 'note_late' as ChangeType,
    description: '',
    affectsConclusion: false,
    operator: '当前用户',
  });

  const inspection = inspections.find((i) => i.id === id);

  useEffect(() => {
    if (inspections.length === 0) {
      fetchInspections();
    }
  }, [inspections.length, fetchInspections]);

  if (!inspection) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500">检查记录不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-primary-600 hover:text-primary-800"
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  const hasFlipData = inspection.flippedCoordinates && inspection.flipDeviation !== undefined;
  const deviationThreshold = settings.flipRules.deviationThreshold;
  const deviationExceeds = hasFlipData && inspection.flipDeviation! > deviationThreshold;

  const handleFlip = async () => {
    if (id) {
      await performFlip(id, flipType);
      setShowFlipDialog(false);
    }
  };

  const handleAddChange = async () => {
    if (id && newChange.description.trim()) {
      await addChangeRecord(id, newChange);
      setShowAddChangeDialog(false);
      setNewChange({ type: 'note_late', description: '', affectsConclusion: false, operator: '当前用户' });
    }
  };

  const handleStatusChange = async (status: InspectionStatus) => {
    if (id) {
      await updateInspectionStatus(id, status);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{inspection.name}</h1>
          <p className="text-slate-600 mt-1">
            {inspection.parkingLot} · {inspection.rampNumber}
          </p>
        </div>
        <StatusBadge status={inspection.status} />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border-2 border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">基本信息</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">创建人</dt>
              <dd className="font-medium text-slate-900">{inspection.createdBy}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">创建时间</dt>
              <dd className="font-mono text-slate-700">{formatDateTime(inspection.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">更新时间</dt>
              <dd className="font-mono text-slate-700">{formatDateTime(inspection.updatedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">坐标点位数</dt>
              <dd className="font-mono font-bold text-slate-900">{inspection.coordinates.points.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">变更记录数</dt>
              <dd className="font-mono font-bold text-slate-900">{inspection.changeHistory.length}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">状态管理</h3>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 mb-2">更新检查状态：</p>
            <div className="grid grid-cols-2 gap-2">
              {(['pending', 'approved', 'exception', 'material_only'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={loading || inspection.status === status}
                  className={`px-3 py-2 rounded border-2 text-sm font-medium transition-all ${
                    inspection.status === status
                      ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                  style={{
                    borderColor: inspection.status === status ? undefined : getStatusColor(status) + '40',
                    color: inspection.status === status ? undefined : getStatusColor(status),
                  }}
                >
                  {status === 'pending' ? '待确认' : status === 'approved' ? '已通过' : status === 'exception' ? '有异常' : '仅补材料'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t-2 border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">快速操作</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowFlipDialog(true)}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded border-2 border-amber-200 hover:bg-amber-100 transition-colors text-sm font-medium"
              >
                <Maximize2 size={16} />
                执行坐标轴翻转
              </button>
              <button
                onClick={() => setShowAddChangeDialog(true)}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 rounded border-2 border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                <Edit3 size={16} />
                添加变更记录
              </button>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-5 border-2 ${hasFlipData ? (deviationExceeds ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200') : 'bg-slate-50 border-slate-200'}`}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: hasFlipData ? (deviationExceeds ? '#991B1B' : '#065F46') : '#475569' }}>
            {hasFlipData ? (deviationExceeds ? <AlertTriangle size={18} /> : <CheckCircle size={18} />) : <AlertTriangle size={18} />}
            坐标轴翻转状态
          </h3>
          {hasFlipData ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: deviationExceeds ? '#991B1B' : '#065F46' }}>
                  翻转偏差
                </span>
                <span className="font-mono font-bold text-xl" style={{ color: deviationExceeds ? '#DC2626' : '#059669' }}>
                  {simplifyNumber(inspection.flipDeviation! * 100, 1)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span style={{ color: deviationExceeds ? '#991B1B' : '#065F46' }}>阈值</span>
                <span className="font-mono" style={{ color: deviationExceeds ? '#DC2626' : '#059669' }}>
                  {simplifyNumber(deviationThreshold * 100, 1)}%
                </span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min((inspection.flipDeviation! / deviationThreshold) * 100, 100)}%`,
                    backgroundColor: deviationExceeds ? '#DC2626' : '#059669',
                  }}
                ></div>
              </div>
              <p className="text-xs mt-2" style={{ color: deviationExceeds ? '#991B1B' : '#065F46' }}>
                {deviationExceeds
                  ? '偏差超过阈值，结论可能受影响，请人工确认'
                  : '偏差在允许范围内，数据一致性良好'}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600">尚未执行坐标轴翻转</p>
              <p className="text-xs text-slate-500 mt-1">点击左侧按钮执行翻转计算</p>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">坐标数据对比</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CoordinatePlot
            coordinates={inspection.coordinates}
            title="原始坐标"
            width={500}
            height={350}
          />
          {hasFlipData ? (
            <CoordinatePlot
              coordinates={inspection.flippedCoordinates!}
              title="翻转后坐标"
              width={500}
              height={350}
              highlight={deviationExceeds}
            />
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center" style={{ height: '100%', minHeight: '420px' }}>
              <div className="text-center text-slate-500">
                <Maximize2 size={48} className="mx-auto mb-3 opacity-30" />
                <p>执行翻转后查看对比数据</p>
              </div>
            </div>
          )}
        </div>

        {hasFlipData && (
          <div className="mt-4 bg-white border-2 border-slate-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">点位数据对比表</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">点位</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">原始 X</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">原始 Y</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">翻转后 X</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">翻转后 Y</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">X 偏差</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Y 偏差</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {inspection.coordinates.points.map((point, index) => {
                    const flipped = inspection.flippedCoordinates!.points[index];
                    const xDiff = flipped.x - point.x;
                    const yDiff = flipped.y - point.y;
                    return (
                      <tr key={point.id} className={xDiff !== 0 || yDiff !== 0 ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-2 font-medium">{point.label}</td>
                        <td className="px-4 py-2 text-center">{point.x}</td>
                        <td className="px-4 py-2 text-center">{point.y}</td>
                        <td className="px-4 py-2 text-center">{flipped.x}</td>
                        <td className="px-4 py-2 text-center">{flipped.y}</td>
                        <td className={`px-4 py-2 text-center ${xDiff !== 0 ? 'text-red-600 font-bold' : ''}`}>
                          {xDiff !== 0 ? (xDiff > 0 ? '+' : '') + xDiff : '-'}
                        </td>
                        <td className={`px-4 py-2 text-center ${yDiff !== 0 ? 'text-red-600 font-bold' : ''}`}>
                          {yDiff !== 0 ? (yDiff > 0 ? '+' : '') + yDiff : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          状态时间线
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({inspection.changeHistory.length} 条记录)
          </span>
        </h2>
        <Timeline changes={inspection.changeHistory} />
      </div>

      {showFlipDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border-2 border-slate-200 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">执行坐标轴翻转</h3>
            <p className="text-sm text-slate-600 mb-4">选择翻转方式，系统将自动计算偏差并更新状态。</p>
            <div className="space-y-3 mb-6">
              {(['origin', 'x', 'y'] as const).map((type) => (
                <label
                  key={type}
                  className={`flex items-center p-3 rounded border-2 cursor-pointer transition-all ${
                    flipType === type ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="flipType"
                    value={type}
                    checked={flipType === type}
                    onChange={() => setFlipType(type)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium text-slate-900">
                      {type === 'origin' ? '原点翻转' : type === 'x' ? 'X轴翻转' : 'Y轴翻转'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {type === 'origin' ? '以中心点为原点进行180度翻转' : type === 'x' ? '沿X轴进行镜像翻转' : '沿Y轴进行镜像翻转'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowFlipDialog(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleFlip}
                disabled={loading}
                className="px-4 py-2 bg-amber-500 text-white rounded border-2 border-amber-600 hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
              >
                确认翻转
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddChangeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border-2 border-slate-200 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">添加变更记录</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">变更类型</label>
                <select
                  value={newChange.type}
                  onChange={(e) => {
                    const type = e.target.value as ChangeType;
                    setNewChange({
                      ...newChange,
                      type,
                      affectsConclusion: type === 'cad_manual' || type === 'flip',
                    });
                  }}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded focus:border-primary-500 focus:outline-none"
                >
                  <option value="route_early">讲解路线早到</option>
                  <option value="note_late">设备备注晚补</option>
                  <option value="cad_manual">CAD点位改动</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">变更说明</label>
                <textarea
                  value={newChange.description}
                  onChange={(e) => setNewChange({ ...newChange, description: e.target.value })}
                  rows={3}
                  placeholder="请详细描述变更内容..."
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newChange.affectsConclusion}
                    onChange={(e) => setNewChange({ ...newChange, affectsConclusion: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">此变更会影响检查结论</span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-6">
                  勾选后将标记为「改结论」，否则为「补材料」
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddChangeDialog(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleAddChange}
                disabled={loading || !newChange.description.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded border-2 border-primary-700 hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
