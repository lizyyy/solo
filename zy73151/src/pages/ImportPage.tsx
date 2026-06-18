import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SourceTypeBadge } from '@/components/common/Badges';
import {
  Upload,
  FileText,
  FilePlus,
  Clock,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Layers,
  Calendar,
} from 'lucide-react';
import type { MaterialSource } from '@/types';
import { sourceTypeLabels } from '@/utils/anomalyDetector';

export default function ImportPage() {
  const { materials, addMaterial, detectAnomalies } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSource, setSelectedSource] = useState<MaterialSource>('lab_result');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    console.log('Dropped files:', files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log('Selected files:', files);
  };

  const sortedMaterials = [...materials].sort(
    (a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
  );

  const sourceIcons = {
    lab_result: FileText,
    late_attachment: Clock,
    verbal_note: MessageSquare,
  };

  const sourceColors = {
    lab_result: 'border-ocean-300 bg-ocean-50',
    late_attachment: 'border-orange-300 bg-orange-50',
    verbal_note: 'border-purple-300 bg-purple-50',
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ocean-800">材料导入</h2>
          <p className="text-sm text-ocean-500 mt-1">
            上传实验室结果表、晚到附件或记录口头说明，系统自动识别版本并检测异常
          </p>
        </div>
        <button
          onClick={detectAnomalies}
          className="btn-primary flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          重新检测异常
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="card-base p-5">
            <h3 className="text-sm font-semibold text-ocean-700 mb-4">选择材料类型</h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(sourceTypeLabels) as MaterialSource[]).map((source) => {
                const Icon = sourceIcons[source];
                const isSelected = selectedSource === source;
                return (
                  <button
                    key={source}
                    onClick={() => setSelectedSource(source)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-ocean-500 bg-ocean-50 shadow-sm'
                        : 'border-ocean-100 bg-white hover:border-ocean-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                      isSelected ? 'bg-ocean-500 text-white' : 'bg-ocean-100 text-ocean-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-ocean-800 text-sm">
                      {sourceTypeLabels[source]}
                    </div>
                    <div className="text-xs text-ocean-500 mt-1">
                      {source === 'lab_result' && '正式实验室检测报告'}
                      {source === 'late_attachment' && '后续补充的数据文件'}
                      {source === 'verbal_note' && '口头说明或备注记录'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`card-base p-8 border-2 border-dashed transition-all ${
              isDragging
                ? 'border-ocean-500 bg-ocean-50'
                : 'border-ocean-200 hover:border-ocean-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center py-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isDragging ? 'bg-ocean-500 text-white' : 'bg-ocean-100 text-ocean-500'
              }`}>
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-ocean-800 mb-1">
                拖拽文件到这里上传
              </h3>
              <p className="text-sm text-ocean-500 mb-4">
                支持 CSV、Excel、TXT 格式，或点击下方按钮选择文件
              </p>
              <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
                <FilePlus className="w-4 h-4" />
                选择文件
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>

          {selectedSource === 'verbal_note' && (
            <div className="card-base p-5">
              <h3 className="text-sm font-semibold text-ocean-700 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                记录口头说明
              </h3>
              <textarea
                placeholder="请输入口头说明内容，例如数据异常原因、补充说明等..."
                className="w-full h-32 p-3 border border-ocean-200 rounded-md text-sm
                           focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-300
                           resize-none placeholder:text-ocean-400"
              />
              <div className="flex justify-end mt-3">
                <button className="btn-secondary text-sm">保存说明</button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ocean-700 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              已上传材料
            </h3>
            <span className="text-xs text-ocean-500">共 {materials.length} 份</span>
          </div>

          <div className="space-y-3">
            {sortedMaterials.map((material, index) => {
              const Icon = sourceIcons[material.source];
              return (
                <div
                  key={material.id}
                  className={`card-base card-hover p-4 border-l-4 ${sourceColors[material.source]} animate-fade-in-up stagger-${index + 1}`}
                  style={{ opacity: 0 }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
                        material.source === 'lab_result' ? 'bg-ocean-200 text-ocean-700' :
                        material.source === 'late_attachment' ? 'bg-orange-200 text-orange-700' :
                        'bg-purple-200 text-purple-700'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-ocean-800 text-sm truncate">
                          {material.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <SourceTypeBadge source={material.source} />
                          <span className="text-xs text-ocean-500">v{material.version}</span>
                          {material.isLatest && (
                            <span className="text-xs text-alert-green font-medium">最新</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ocean-400 flex-shrink-0" />
                  </div>

                  <div className="mt-3 pt-3 border-t border-ocean-100/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-ocean-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>上传时间：{material.uploadTime}</span>
                    </div>
                    {material.parsedData.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-ocean-500">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{material.parsedData.length} 条记录</span>
                      </div>
                    )}
                    {material.description && (
                      <p className="text-xs text-ocean-600 line-clamp-2">
                        {material.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {material.isLatest ? (
                      <span className="flex items-center gap-1 text-xs text-alert-green">
                        <CheckCircle className="w-3 h-3" />
                        当前有效版本
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-ocean-400">
                        <X className="w-3 h-3" />
                        已被新版本替换
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-ocean-50 rounded-lg border border-ocean-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-ocean-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-ocean-700">版本说明</p>
                <p className="text-xs text-ocean-500 mt-0.5">
                  系统会自动对比不同版本材料的数据差异，标记口径变更和单位混写等异常。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
