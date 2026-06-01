import { useState, useRef } from 'react';
import { X, Upload, AlertTriangle, Check, FileJson, FileSpreadsheet, Copy, Trash2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFormationStore } from '@/store/formationStore';
import { parseCSV, parseJSON, readFileAsText } from '@/utils/import';
import type { ImportPreviewItem } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SourceBadge } from '@/components/common/SourceBadge';

export function ImportModal() {
  const { showImportModal, setShowImportModal } = useUIStore();
  const { addDrone, setDrones } = useFormationStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    try {
      const text = await readFileAsText(file);
      let items: ImportPreviewItem[] = [];

      if (file.name.endsWith('.csv')) {
        items = parseCSV(text);
      } else if (file.name.endsWith('.json')) {
        items = parseJSON(text);
      } else {
        alert('请上传 CSV 或 JSON 格式的文件');
        return;
      }

      setPreviewItems(items);
      setSelectedItems(new Set(items.map((item) => item.drone.id)));
    } catch (e) {
      console.error('文件解析失败:', e);
      alert('文件解析失败，请检查文件格式');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(previewItems.map((item) => item.drone.id)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleImport = () => {
    const itemsToImport = previewItems.filter((item) =>
      selectedItems.has(item.drone.id)
    );

    if (itemsToImport.length === 0) {
      alert('请至少选择一条数据');
      return;
    }

    itemsToImport.forEach((item) => {
      addDrone(item.drone);
    });

    alert(`成功导入 ${itemsToImport.length} 条数据`);
    setShowImportModal(false);
    setPreviewItems([]);
    setSelectedItems(new Set());
    setFileName('');
  };

  const handleClose = () => {
    setShowImportModal(false);
    setPreviewItems([]);
    setSelectedItems(new Set());
    setFileName('');
  };

  const getIssueIcon = (item: ImportPreviewItem) => {
    if (item.isEmpty) return <AlertTriangle size={12} className="text-red-400" />;
    if (item.isDuplicate) return <Copy size={12} className="text-purple-400" />;
    if (item.isBoundary) return <AlertTriangle size={12} className="text-orange-400" />;
    if (item.issues.length > 0) return <AlertTriangle size={12} className="text-yellow-400" />;
    return <Check size={12} className="text-green-400" />;
  };

  if (!showImportModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#0f1e36] border border-white/10 rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Upload size={20} className="text-blue-400" />
            导入数据
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {previewItems.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/20 hover:border-blue-500/50 hover:bg-white/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Upload size={32} className="text-blue-400" />
              </div>
              <p className="text-sm text-white mb-2">拖拽文件到此处，或点击选择</p>
              <p className="text-xs text-gray-500 mb-4">支持 CSV、JSON 格式</p>
              <div className="flex items-center justify-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <FileSpreadsheet size={14} className="text-green-400" />
                  CSV
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <FileJson size={14} className="text-yellow-400" />
                  JSON
                </span>
              </div>
              <div className="mt-6 p-4 bg-black/20 rounded-lg text-left">
                <p className="text-xs text-gray-400 mb-2">CSV 格式说明：</p>
                <code className="text-[10px] text-gray-500 font-mono block">
                  id,name,x,y,z,status,sourceType,sourceRef,obstacleDistance,note
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">文件: <span className="text-blue-400">{fileName}</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    共 {previewItems.length} 条记录，已选择 {selectedItems.size} 条
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1 text-xs text-gray-300 hover:bg-white/10 rounded transition-colors"
                  >
                    全选
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1 text-xs text-gray-300 hover:bg-white/10 rounded transition-colors"
                  >
                    取消全选
                  </button>
                  <button
                    onClick={() => {
                      setPreviewItems([]);
                      setSelectedItems(new Set());
                      setFileName('');
                    }}
                    className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    清除
                  </button>
                </div>
              </div>

              <div className="border border-white/10 rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-black/30 sticky top-0">
                      <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                        <th className="w-8 p-2">
                          <input
                            type="checkbox"
                            checked={selectedItems.size === previewItems.length && previewItems.length > 0}
                            onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                            className="rounded border-white/20 bg-transparent"
                          />
                        </th>
                        <th className="p-2 text-left">状态</th>
                        <th className="p-2 text-left">编号</th>
                        <th className="p-2 text-left">坐标</th>
                        <th className="p-2 text-left">距离</th>
                        <th className="p-2 text-left">来源</th>
                        <th className="p-2 text-left">问题</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {previewItems.map((item) => (
                        <tr
                          key={item.drone.id}
                          className={`text-xs hover:bg-white/5 transition-colors ${
                            selectedItems.has(item.drone.id) ? 'bg-blue-500/10' : ''
                          } ${
                            item.isEmpty ? 'bg-red-500/5' : item.isDuplicate ? 'bg-purple-500/5' : item.isBoundary ? 'bg-orange-500/5' : ''
                          }`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.drone.id)}
                              onChange={() => toggleSelectItem(item.drone.id)}
                              className="rounded border-white/20 bg-transparent"
                            />
                          </td>
                          <td className="p-2">
                            <StatusBadge status={item.drone.status} />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {getIssueIcon(item)}
                              <span className="text-white font-mono">{item.drone.id}</span>
                            </div>
                          </td>
                          <td className="p-2 text-gray-400 font-mono">
                            {item.isEmpty ? (
                              <span className="text-red-400">缺失</span>
                            ) : (
                              `${item.drone.position.x.toFixed(0)}, ${item.drone.position.y.toFixed(0)}, ${item.drone.position.z.toFixed(0)}`
                            )}
                          </td>
                          <td className="p-2">
                            <span
                              className={`font-mono ${
                                item.drone.obstacleDistance < 0
                                  ? 'text-red-400'
                                  : item.drone.obstacleDistance < 3
                                  ? 'text-red-400'
                                  : item.drone.obstacleDistance < 5
                                  ? 'text-orange-400'
                                  : 'text-green-400'
                              }`}
                            >
                              {item.drone.obstacleDistance >= 0
                                ? `${item.drone.obstacleDistance.toFixed(1)}m`
                                : '无效'}
                            </span>
                          </td>
                          <td className="p-2">
                            <SourceBadge type={item.drone.source.type} />
                          </td>
                          <td className="p-2 max-w-[200px]">
                            {item.issues.length > 0 ? (
                              <span className="text-[10px] text-yellow-400">
                                {item.issues.join('; ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-green-400">正常</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-xs text-gray-400 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span>
                    导入前请确认数据。空值数据将标记为错误状态，重复数据将保留最新版本，边界数据将显示警告。
                    所有数据都将保留来源信息，可在详情面板中追溯原始记录。
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div className="text-xs text-gray-500">
            {previewItems.length > 0 && (
              <span>
                准备导入 <span className="text-white">{selectedItems.size}</span> 条数据
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-xs text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={previewItems.length === 0 || selectedItems.size === 0}
              className="px-4 py-2 text-xs text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Upload size={14} />
              确认导入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
