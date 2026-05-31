import { useState, useCallback } from 'react';
import {
  Upload,
  Plus,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Play,
} from 'lucide-react';
import { useHandoverStore } from '@/store/useHandoverStore';
import {
  MATERIAL_TYPE_LABELS,
  MATERIAL_STATUS_LABELS,
  HANDOVER_STATUS_LABELS,
  EXCEPTION_TYPE_LABELS,
} from '@/types';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [dragActive, setDragActive] = useState(false);
  const [isLateUpload, setIsLateUpload] = useState(false);
  const [newHandoverTitle, setNewHandoverTitle] = useState('');
  const [showNewHandover, setShowNewHandover] = useState(false);

  const {
    handovers,
    currentHandoverId,
    createHandover,
    selectHandover,
    deleteHandover,
    updateHandoverStatus,
    addMaterial,
    getCurrentHandover,
    getMaterialsForHandover,
    getExceptionsForHandover,
    addConfirmation,
  } = useHandoverStore();

  const currentHandover = getCurrentHandover();
  const materials = currentHandover ? getMaterialsForHandover(currentHandover.id) : [];
  const exceptions = currentHandover ? getExceptionsForHandover(currentHandover.id) : [];
  const openExceptions = exceptions.filter(e => e.status === 'open');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (!currentHandoverId) {
        alert('请先选择或创建一个交接单');
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await addMaterial(currentHandoverId, file, isLateUpload);
      }
    },
    [currentHandoverId, addMaterial, isLateUpload]
  );

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentHandoverId) {
      alert('请先选择或创建一个交接单');
      return;
    }

    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addMaterial(currentHandoverId, file, isLateUpload);
    }
    e.target.value = '';
  };

  const handleCreateHandover = () => {
    if (newHandoverTitle.trim()) {
      createHandover(newHandoverTitle.trim());
      setNewHandoverTitle('');
      setShowNewHandover(false);
    }
  };

  const handleStartProcessing = () => {
    if (currentHandoverId) {
      updateHandoverStatus(currentHandoverId, 'processing', '开始处理交接');
    }
  };

  const handleConfirm = () => {
    if (currentHandoverId) {
      const materialIds = materials.map(m => m.id);
      addConfirmation(currentHandoverId, materialIds, '人工确认所有材料');
    }
  };

  const handleComplete = () => {
    if (currentHandoverId) {
      updateHandoverStatus(currentHandoverId, 'completed', '交接完成');
    }
  };

  const stats = {
    total: materials.length,
    normal: materials.filter(m => m.status === 'normal').length,
    duplicates: materials.filter(m => m.status === 'duplicate').length,
    missing: materials.filter(m => m.status === 'missing').length,
    late: materials.filter(m => m.status === 'late').length,
    corrected: materials.filter(m => m.status === 'corrected').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gallery-900">交接工作台</h1>
          <p className="text-sm text-gallery-500 mt-1">管理雕塑运输交接材料和状态</p>
        </div>
        <button
          onClick={() => setShowNewHandover(true)}
          className="flex items-center gap-2 bg-gallery-900 text-white px-4 py-2 rounded hover:bg-gallery-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建交接单
        </button>
      </div>

      {showNewHandover && (
        <div className="bg-white border border-gallery-200 rounded-lg p-4">
          <h3 className="font-medium mb-3">创建新交接单</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newHandoverTitle}
              onChange={e => setNewHandoverTitle(e.target.value)}
              placeholder="输入交接单名称，如：2024春季雕塑展-作品A"
              className="flex-1 px-3 py-2 border border-gallery-300 rounded focus:outline-none focus:border-gallery-500"
              onKeyDown={e => e.key === 'Enter' && handleCreateHandover()}
            />
            <button
              onClick={handleCreateHandover}
              className="bg-accent-success text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
            >
              创建
            </button>
            <button
              onClick={() => setShowNewHandover(false)}
              className="px-4 py-2 border border-gallery-300 rounded hover:bg-gallery-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {handovers.length > 0 && (
        <div className="bg-white border border-gallery-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gallery-200">
            <h3 className="font-medium">交接单列表</h3>
          </div>
          <div className="divide-y divide-gallery-100">
            {handovers.map(handover => (
              <div
                key={handover.id}
                className={cn(
                  'p-4 flex items-center justify-between cursor-pointer transition-colors',
                  currentHandoverId === handover.id
                    ? 'bg-gallery-50'
                    : 'hover:bg-gallery-50'
                )}
                onClick={() => selectHandover(handover.id)}
              >
                <div className="flex items-center gap-4">
                  <FileText className="w-5 h-5 text-gallery-400" />
                  <div>
                    <div className="font-medium">{handover.title}</div>
                    <div className="text-xs text-gallery-500">
                      创建于 {new Date(handover.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-xs px-2 py-1 rounded',
                      handover.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : handover.status === 'processing'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gallery-100 text-gallery-600'
                    )}
                  >
                    {HANDOVER_STATUS_LABELS[handover.status]}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm('确定删除此交接单？')) {
                        deleteHandover(handover.id);
                      }
                    }}
                    className="p-1 text-gallery-400 hover:text-accent-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentHandover && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-gallery-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-gallery-900">{stats.total}</div>
              <div className="text-sm text-gallery-500 mt-1">材料总数</div>
            </div>
            <div className="bg-white border border-gallery-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-accent-success">{stats.normal}</div>
              <div className="text-sm text-gallery-500 mt-1">正常</div>
            </div>
            <div className="bg-white border border-gallery-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-accent-warning">
                {stats.duplicates + stats.late}
              </div>
              <div className="text-sm text-gallery-500 mt-1">异常</div>
            </div>
            <div className="bg-white border border-gallery-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-accent-danger">{openExceptions.length}</div>
              <div className="text-sm text-gallery-500 mt-1">待处理</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white border border-gallery-200 rounded-lg p-6">
              <h3 className="font-medium mb-4">上传材料</h3>

              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-gallery-600">
                  <input
                    type="checkbox"
                    checked={isLateUpload}
                    onChange={e => setIsLateUpload(e.target.checked)}
                    className="rounded border-gallery-300"
                  />
                  标记为晚到附件
                </label>
              </div>

              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  dragActive
                    ? 'border-accent-info bg-blue-50'
                    : 'border-gallery-300 hover:border-gallery-400'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto text-gallery-400 mb-4" />
                <p className="text-gallery-600 mb-2">拖拽文件到此处上传</p>
                <p className="text-sm text-gallery-400 mb-4">或</p>
                <label className="inline-block">
                  <span className="bg-gallery-100 text-gallery-700 px-4 py-2 rounded cursor-pointer hover:bg-gallery-200 transition-colors">
                    选择文件
                  </span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </label>
              </div>

              <p className="text-xs text-gallery-400 mt-3">
                支持的文件类型：展墙图 (jpg, png)、保险单 (pdf)、布展清单、灯光记录、备注、其他附件
              </p>
            </div>

            <div className="bg-white border border-gallery-200 rounded-lg p-6">
              <h3 className="font-medium mb-4">快速操作</h3>
              <div className="space-y-3">
                {currentHandover.status === 'draft' && (
                  <button
                    onClick={handleStartProcessing}
                    className="w-full flex items-center justify-center gap-2 bg-accent-info text-white px-4 py-3 rounded hover:bg-blue-600 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    开始处理
                  </button>
                )}

                {currentHandover.status === 'processing' && (
                  <>
                    <button
                      onClick={handleConfirm}
                      className="w-full flex items-center justify-center gap-2 bg-accent-warning text-white px-4 py-3 rounded hover:bg-amber-600 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      人工确认材料
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={openExceptions.length > 0}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 px-4 py-3 rounded transition-colors',
                        openExceptions.length > 0
                          ? 'bg-gallery-200 text-gallery-400 cursor-not-allowed'
                          : 'bg-accent-success text-white hover:bg-green-600'
                      )}
                    >
                      <CheckCircle className="w-5 h-5" />
                      完成交接
                    </button>
                    {openExceptions.length > 0 && (
                      <p className="text-xs text-accent-danger text-center">
                        请先处理所有异常后再完成交接
                      </p>
                    )}
                  </>
                )}

                {currentHandover.status === 'pending_confirm' && (
                  <button
                    onClick={handleComplete}
                    className="w-full flex items-center justify-center gap-2 bg-accent-success text-white px-4 py-3 rounded hover:bg-green-600 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    完成交接
                  </button>
                )}

                {currentHandover.status === 'completed' && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-12 h-12 mx-auto text-accent-success mb-2" />
                    <p className="text-gallery-600">交接已完成</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {materials.length > 0 && (
            <div className="bg-white border border-gallery-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gallery-200">
                <h3 className="font-medium">已上传材料 ({materials.length})</h3>
              </div>
              <div className="divide-y divide-gallery-100 max-h-80 overflow-auto">
                {materials.map(material => (
                  <div key={material.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gallery-400" />
                      <div>
                        <div className="font-medium text-sm">{material.name}</div>
                        <div className="text-xs text-gallery-500">
                          {MATERIAL_TYPE_LABELS[material.type]} · {material.fileName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded',
                          material.status === 'normal'
                            ? 'bg-green-100 text-green-700'
                            : material.status === 'duplicate'
                            ? 'bg-amber-100 text-amber-700'
                            : material.status === 'late'
                            ? 'bg-orange-100 text-orange-700'
                            : material.status === 'corrected'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        {MATERIAL_STATUS_LABELS[material.status]}
                      </span>
                      <span className="text-xs text-gallery-400">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(material.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {openExceptions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-accent-warning flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">待处理异常 ({openExceptions.length})</h4>
                  <div className="mt-2 space-y-1">
                    {openExceptions.slice(0, 3).map(e => (
                      <div key={e.id} className="text-sm text-amber-700">
                        • {EXCEPTION_TYPE_LABELS[e.type]}: {e.description}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!currentHandover && handovers.length === 0 && (
        <div className="bg-white border border-gallery-200 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gallery-300 mb-4" />
          <h3 className="text-lg font-medium text-gallery-700 mb-2">暂无交接单</h3>
          <p className="text-gallery-500 mb-6">点击上方按钮创建新的交接单开始工作</p>
        </div>
      )}
    </div>
  );
}
