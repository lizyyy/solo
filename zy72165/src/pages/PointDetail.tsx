import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  FileText,
  AlertTriangle,
  Plus,
  X,
  Save,
  Clock,
  User,
  Tag,
  MapPin,
  Check,
  Trash2,
  Eye,
} from 'lucide-react';
import { useAppStore } from '../store';
import StatusBadge from '../components/StatusBadge';
import { readFileAsDataURL } from '../utils/importExport';
import type { SchemeStatus, ConflictType } from '../types';

const PointDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    getPointById,
    updatePoint,
    getPhotosByPointId,
    addPhoto,
    deletePhoto,
    getSchemesByPointId,
    addScheme,
    getConflictsByPointId,
    addConflict,
    resolveConflict,
  } = useAppStore();

  const point = getPointById(id || '');
  const photos = getPhotosByPointId(id || '');
  const schemes = getSchemesByPointId(id || '');
  const conflicts = getConflictsByPointId(id || '');

  const [activeTab, setActiveTab] = useState<'info' | 'photos' | 'schemes' | 'conflicts'>('info');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    location: '',
    hospital: '',
    rawNote: '',
  });

  const [newScheme, setNewScheme] = useState({
    content: '',
    opinion: '',
    status: 'draft' as SchemeStatus,
  });
  const [showNewScheme, setShowNewScheme] = useState(false);

  const [newConflict, setNewConflict] = useState({
    type: 'data_mismatch' as ConflictType,
    photoEvidence: '',
    dataEvidence: '',
    suggestedAction: '',
  });
  const [showNewConflict, setShowNewConflict] = useState(false);

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!point) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">点位不存在</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
        >
          返回列表
        </button>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditForm({
      name: point.name,
      location: point.location,
      hospital: point.hospital,
      rawNote: point.rawNote,
    });
    setEditing(true);
  };

  const handleSaveEdit = () => {
    updatePoint(point.id, editForm);
    setEditing(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const dataUrl = await readFileAsDataURL(file);
      addPhoto({
        pointId: point.id,
        dataUrl,
        fileName: file.name,
        rawRemark: '',
        source: '现场巡检',
      });
    }
  };

  const handlePhotoRemarkChange = (photoId: string, remark: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (photo) {
      deletePhoto(photoId);
      addPhoto({
        pointId: photo.pointId,
        dataUrl: photo.dataUrl,
        fileName: photo.fileName,
        rawRemark: remark,
        source: photo.source,
        takenAt: photo.takenAt,
      });
    }
  };

  const handleAddScheme = () => {
    if (!newScheme.content.trim()) return;
    addScheme({
      pointId: point.id,
      content: newScheme.content,
      opinion: newScheme.opinion,
      status: newScheme.status,
      createdBy: '老曹',
    });
    setNewScheme({ content: '', opinion: '', status: 'draft' });
    setShowNewScheme(false);
  };

  const handleAddConflict = () => {
    if (!newConflict.photoEvidence || !newConflict.dataEvidence) return;
    addConflict({
      pointId: point.id,
      type: newConflict.type,
      photoEvidence: newConflict.photoEvidence,
      dataEvidence: newConflict.dataEvidence,
      suggestedAction: newConflict.suggestedAction,
    });
    setNewConflict({
      type: 'data_mismatch',
      photoEvidence: '',
      dataEvidence: '',
      suggestedAction: '',
    });
    setShowNewConflict(false);
    updatePoint(point.id, { status: 'conflict' });
  };

  const handleResolveConflict = (conflictId: string, resolution: string) => {
    resolveConflict(conflictId, resolution);
    const remainingConflicts = conflicts.filter(
      (c) => c.id !== conflictId && !c.resolved
    );
    if (remainingConflicts.length === 0 && point.status === 'conflict') {
      updatePoint(point.id, { status: 'processing' });
    }
  };

  const tabs = [
    { key: 'info', label: '点位信息', icon: MapPin },
    { key: 'photos', label: `照片 (${photos.length})`, icon: Camera },
    { key: 'schemes', label: `方案版本 (${schemes.length})`, icon: FileText },
    { key: 'conflicts', label: `冲突记录 (${conflicts.filter((c) => !c.resolved).length})`, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{point.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge type="point" value={point.status} />
              <StatusBadge type="source" value={point.source} />
            </div>
          </div>
        </div>
        {!editing && (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Save className="w-4 h-4" />
            编辑点位
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">点位名称</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">位置</label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">所属医院</label>
                      <input
                        type="text"
                        value={editForm.hospital}
                        onChange={(e) => setEditForm({ ...editForm, hospital: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">原始备注 <span className="text-amber-600">(不清洗)</span></label>
                    <textarea
                      value={editForm.rawNote}
                      onChange={(e) => setEditForm({ ...editForm, rawNote: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      保存修改
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">位置</p>
                      <p className="text-slate-800 font-medium">{point.location}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">所属医院</p>
                      <p className="text-slate-800 font-medium">{point.hospital}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">来源</p>
                      <p className="text-slate-800">{point.sourceDesc || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">创建人</p>
                      <p className="text-slate-800 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {point.createdBy}
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">原始备注</span>
                      <span className="text-xs text-amber-600">(保留原样，未清洗)</span>
                    </div>
                    <p className="text-amber-900 whitespace-pre-wrap font-mono text-sm">
                      {point.rawNote || '(无原始备注)'}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>创建于 {new Date(point.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>更新于 {new Date(point.updatedAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">上传现场照片，保留原始备注</p>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    上传照片
                  </button>
                </div>
              </div>

              {photos.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Camera className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>暂无照片，点击上方按钮上传</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="group relative">
                      <div
                        className="aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer"
                        onClick={() => setSelectedPhoto(photo.dataUrl)}
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.fileName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="添加原始备注..."
                          value={photo.rawRemark}
                          onChange={(e) => handlePhotoRemarkChange(photo.id, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="truncate max-w-[120px]">{photo.fileName}</span>
                          <button
                            onClick={() => {
                              if (confirm('确定删除这张照片？')) {
                                deletePhoto(photo.id);
                              }
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'schemes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">方案版本历史，旧方案永不删除</p>
                <button
                  onClick={() => setShowNewScheme(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新建方案
                </button>
              </div>

              {showNewScheme && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-slate-800">新建方案版本</h3>
                    <button
                      onClick={() => setShowNewScheme(false)}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">方案内容</label>
                      <textarea
                        value={newScheme.content}
                        onChange={(e) => setNewScheme({ ...newScheme, content: e.target.value })}
                        rows={4}
                        placeholder="描述停车诱导方案内容..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">历史意见/备注</label>
                      <textarea
                        value={newScheme.opinion}
                        onChange={(e) => setNewScheme({ ...newScheme, opinion: e.target.value })}
                        rows={2}
                        placeholder="记录审批意见、修改原因等（可选）"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <select
                        value={newScheme.status}
                        onChange={(e) => setNewScheme({ ...newScheme, status: e.target.value as SchemeStatus })}
                        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="draft">草稿</option>
                        <option value="submitted">已提交</option>
                        <option value="approved">已批准</option>
                        <option value="rejected">已驳回</option>
                      </select>
                      <button
                        onClick={handleAddScheme}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                      >
                        保存方案
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {schemes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>暂无方案记录，点击上方按钮新建</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schemes.map((scheme) => (
                    <div
                      key={scheme.id}
                      className="border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-700">V{scheme.version}</span>
                          <StatusBadge type="scheme" value={scheme.status} />
                          <span className="text-sm text-slate-500">
                            {new Date(scheme.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <span className="text-sm text-slate-500 flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {scheme.createdBy}
                        </span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <p className="text-sm text-slate-500 mb-1">方案内容</p>
                          <p className="text-slate-800 whitespace-pre-wrap">{scheme.content}</p>
                        </div>
                        {scheme.opinion && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-sm text-blue-600 mb-1">历史意见/备注</p>
                            <p className="text-blue-800 whitespace-pre-wrap">{scheme.opinion}</p>
                          </div>
                        )}
                        {scheme.approvalRecord && (
                          <div className="bg-emerald-50 rounded-lg p-3">
                            <p className="text-sm text-emerald-600 mb-1">审批记录</p>
                            <p className="text-emerald-800">{scheme.approvalRecord}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conflicts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">数据冲突记录，展示双边证据，不自动处理</p>
                <button
                  onClick={() => setShowNewConflict(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  标记冲突
                </button>
              </div>

              {showNewConflict && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-red-800">标记数据冲突</h3>
                    <button
                      onClick={() => setShowNewConflict(false)}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">冲突类型</label>
                      <select
                        value={newConflict.type}
                        onChange={(e) => setNewConflict({ ...newConflict, type: e.target.value as ConflictType })}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="data_mismatch">数据不一致</option>
                        <option value="scheme_override">方案覆盖</option>
                        <option value="note_conflict">备注冲突</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-red-700 mb-1">照片/现场证据</label>
                        <textarea
                          value={newConflict.photoEvidence}
                          onChange={(e) => setNewConflict({ ...newConflict, photoEvidence: e.target.value })}
                          rows={3}
                          placeholder="描述照片或现场发现的情况..."
                          className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-red-700 mb-1">导入/表格数据</label>
                        <textarea
                          value={newConflict.dataEvidence}
                          onChange={(e) => setNewConflict({ ...newConflict, dataEvidence: e.target.value })}
                          rows={3}
                          placeholder="描述导入数据或表格中的情况..."
                          className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">建议动作（可选）</label>
                      <input
                        type="text"
                        value={newConflict.suggestedAction}
                        onChange={(e) => setNewConflict({ ...newConflict, suggestedAction: e.target.value })}
                        placeholder="建议如何处理这个冲突..."
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddConflict}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        确认标记
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {conflicts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Check className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                  <p>暂无冲突记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      className={`border rounded-lg overflow-hidden ${
                        conflict.resolved
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-red-200'
                      }`}
                    >
                      <div className="px-4 py-3 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-3">
                          <StatusBadge type="conflict" value={conflict.type} />
                          <span className="text-sm text-slate-500">
                            {new Date(conflict.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        {conflict.resolved ? (
                          <span className="flex items-center gap-1 text-sm text-emerald-600">
                            <Check className="w-4 h-4" />
                            已解决
                          </span>
                        ) : (
                          <span className="text-sm text-red-600">待处理</span>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-orange-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-orange-600 mb-1">📸 照片/现场证据</p>
                            <p className="text-orange-800 text-sm">{conflict.photoEvidence}</p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-blue-600 mb-1">📊 导入/表格数据</p>
                            <p className="text-blue-800 text-sm">{conflict.dataEvidence}</p>
                          </div>
                        </div>
                        {conflict.suggestedAction && (
                          <div className="bg-amber-50 rounded-lg p-3 mb-4">
                            <p className="text-xs font-medium text-amber-600 mb-1">💡 建议动作</p>
                            <p className="text-amber-800 text-sm">{conflict.suggestedAction}</p>
                          </div>
                        )}
                        {conflict.resolved && conflict.resolution ? (
                          <div className="bg-emerald-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-emerald-600 mb-1">✅ 解决说明</p>
                            <p className="text-emerald-800 text-sm">{conflict.resolution}</p>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="记录解决说明..."
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              id={`resolution-${conflict.id}`}
                            />
                            <button
                              onClick={() => {
                                const input = document.getElementById(`resolution-${conflict.id}`) as HTMLInputElement;
                                if (input?.value.trim()) {
                                  handleResolveConflict(conflict.id, input.value);
                                }
                              }}
                              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                            >
                              标记解决
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={selectedPhoto} alt="预览" className="max-w-full max-h-[90vh] object-contain" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointDetail;
