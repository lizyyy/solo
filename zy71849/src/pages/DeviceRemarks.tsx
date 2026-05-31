import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store';
import { FileText, Edit3, History, User, Clock, Save, X, Search, Filter } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import TraceSidebar from '@/components/TraceSidebar';
import { Coordinate, RemarkHistory } from '@/types';
import { formatChangeSummary, formatCoordinateDiff } from '@/utils/historyTracker';

export default function DeviceRemarks() {
  const { id } = useParams();
  const {
    deviceRemarks,
    remarkHistories,
    loadRemarkHistories,
    updateDeviceRemark,
    loadProjectData,
    currentUser,
    selectedRecord,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCoordinate, setEditCoordinate] = useState<Coordinate>({ x: 0, y: 0, z: 0 });
  const [editReason, setEditReason] = useState('');
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');

  useEffect(() => {
    if (id) {
      loadProjectData(id);
    }
  }, [id, loadProjectData]);

  const areas = ['all', ...new Set(deviceRemarks.map((r) => r.area))];

  const filteredRemarks = deviceRemarks.filter((r) => {
    const matchesSearch =
      r.deviceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = areaFilter === 'all' || r.area === areaFilter;
    return matchesSearch && matchesArea;
  });

  const handleEdit = (remark: typeof deviceRemarks[0]) => {
    setEditingId(remark.id);
    setEditContent(remark.content);
    setEditCoordinate({ ...remark.coordinate });
    setEditReason('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditCoordinate({ x: 0, y: 0, z: 0 });
    setEditReason('');
  };

  const handleSave = async (remarkId: string) => {
    if (!editReason.trim()) {
      alert('请填写修改原因');
      return;
    }
    await updateDeviceRemark(remarkId, editContent, editCoordinate, editReason);
    handleCancelEdit();
  };

  const handleToggleHistory = (remarkId: string) => {
    if (showHistory === remarkId) {
      setShowHistory(null);
    } else {
      setShowHistory(remarkId);
      if (!remarkHistories[remarkId]) {
        loadRemarkHistories(remarkId);
      }
    }
  };

  if (!id) return null;

  return (
    <div className="p-8 relative">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-serif text-2xl font-semibold text-slate-800 flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary-600" />
            设备备注
          </h1>
          <span className="badge bg-primary-100 text-primary-700">
            共 {deviceRemarks.length} 条记录
          </span>
        </div>
        <p className="text-sm text-slate-500">管理设备坐标和备注信息，所有修改都会被记录</p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索设备编号、名称或备注..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="input max-w-32"
          >
            {areas.map((area) => (
              <option key={area} value={area}>
                {area === 'all' ? '全部区域' : area}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>设备编号</th>
                <th>设备名称</th>
                <th>区域</th>
                <th>备注内容</th>
                <th>坐标 (X, Y, Z)</th>
                <th>修改人</th>
                <th>修改时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRemarks.map((remark) => (
                <>
                  <tr key={remark.id} className={editingId === remark.id ? 'bg-primary-50/50' : ''}>
                    <td className="font-mono text-sm text-primary-700">{remark.deviceCode}</td>
                    <td>{remark.deviceName}</td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-600">{remark.area}</span>
                    </td>
                    <td className="max-w-xs">
                      {editingId === remark.id ? (
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="input"
                          rows={2}
                        />
                      ) : (
                        <p className="truncate" title={remark.content}>{remark.content}</p>
                      )}
                    </td>
                    <td className="font-mono text-xs">
                      {editingId === remark.id ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            value={editCoordinate.x}
                            onChange={(e) => setEditCoordinate({ ...editCoordinate, x: Number(e.target.value) })}
                            className="input"
                            placeholder="X"
                          />
                          <input
                            type="number"
                            value={editCoordinate.y}
                            onChange={(e) => setEditCoordinate({ ...editCoordinate, y: Number(e.target.value) })}
                            className="input"
                            placeholder="Y"
                          />
                          <input
                            type="number"
                            value={editCoordinate.z}
                            onChange={(e) => setEditCoordinate({ ...editCoordinate, z: Number(e.target.value) })}
                            className="input"
                            placeholder="Z"
                          />
                        </div>
                      ) : (
                        <span>
                          {remark.coordinate.x}, {remark.coordinate.y}, {remark.coordinate.z}
                        </span>
                      )}
                    </td>
                    <td className="flex items-center gap-1.5 text-sm text-slate-600">
                      <User className="w-3.5 h-3.5" />
                      {remark.modifier}
                    </td>
                    <td className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(remark.modifiedAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td>
                      {editingId === remark.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(remark.id)}
                            className="btn btn-success text-xs flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="btn btn-secondary text-xs flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(remark)}
                            className="p-1.5 hover:bg-primary-50 text-primary-600 rounded-md transition-colors"
                            title="编辑"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleHistory(remark.id)}
                            className={`p-1.5 rounded-md transition-colors ${
                              showHistory === remark.id
                                ? 'bg-primary-50 text-primary-600'
                                : 'hover:bg-slate-100 text-slate-500'
                            }`}
                            title="查看历史"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {editingId === remark.id && (
                    <tr className="bg-primary-50/30">
                      <td colSpan={8} className="p-4">
                        <div className="max-w-lg">
                          <label className="label">修改原因 *</label>
                          <textarea
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="请详细说明修改原因，这将被记录在历史中..."
                            className="input"
                            rows={2}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            当前操作人：{currentUser}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {showHistory === remark.id && remarkHistories[remark.id] && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={8} className="p-4">
                        <div className="max-w-2xl">
                          <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            修改历史记录
                          </h4>
                          <div className="space-y-4">
                            {remarkHistories[remark.id].map((history: RemarkHistory, index: number) => (
                              <div key={index} className="timeline-item">
                                <div className="timeline-dot active" />
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-slate-700">{history.modifier}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">
                                    {new Date(history.modifiedAt).toLocaleString('zh-CN')}
                                  </span>
                                  <StatusBadge status="manual-modified" />
                                </div>
                                <p className="text-sm text-slate-600 mt-1">
                                  修改：{formatChangeSummary(history)}
                                </p>
                                <p className="text-sm text-slate-500 mt-0.5">
                                  原因：{history.changeReason}
                                </p>
                                {(() => {
                                  const diff = formatCoordinateDiff(history);
                                  const hasCoordChange = diff.x.changed || diff.y.changed || diff.z.changed;
                                  if (!hasCoordChange && history.oldContent === history.newContent) return null;
                                  return (
                                    <div className="mt-2 bg-white rounded-lg border border-slate-200 p-3">
                                      {history.oldContent !== history.newContent && (
                                        <div className="mb-2">
                                          <p className="text-xs text-slate-500 mb-1">备注内容变更：</p>
                                          <div className="text-xs">
                                            <p className="text-red-600 line-through">{history.oldContent}</p>
                                            <p className="text-green-600 mt-0.5">{history.newContent}</p>
                                          </div>
                                        </div>
                                      )}
                                      {hasCoordChange && (
                                        <div>
                                          <p className="text-xs text-slate-500 mb-1">坐标变更：</p>
                                          <div className="text-xs font-mono space-y-0.5">
                                            {['x', 'y', 'z'].map((axis) => {
                                              const axisDiff = diff[axis as keyof typeof diff];
                                              if (!axisDiff.changed) return null;
                                              return (
                                                <div key={axis}>
                                                  {axis.toUpperCase()}: <span className="text-red-600">{axisDiff.oldValue}</span> → <span className="text-green-600">{axisDiff.newValue}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRemarks.length === 0 && (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无匹配的设备备注</p>
        </div>
      )}

      {selectedRecord && <TraceSidebar />}
    </div>
  );
}
