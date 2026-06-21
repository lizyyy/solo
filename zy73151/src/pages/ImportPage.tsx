import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { SourceTypeBadge, SeverityBadge } from '@/components/common/Badges';
import {
  Upload,
  FileText,
  FilePlus,
  Clock,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Layers,
  Calendar,
  X,
  Sparkles,
  Download,
  RefreshCw,
  ArrowRight,
  Gauge,
  AlertOctagon,
} from 'lucide-react';
import type { MaterialSource } from '@/types';
import { sourceTypeLabels } from '@/utils/anomalyDetector';
import { generateSampleCSV } from '@/utils/csvParser';

export default function ImportPage() {
  const {
    materials,
    stations,
    uploadCSV,
    addVerbalNote,
    lastUpload,
    resetToMockData,
    detectAnomalies,
    anomalies,
  } = useAppStore();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSource, setSelectedSource] = useState<MaterialSource>('lab_result');
  const [verbalContent, setVerbalContent] = useState('');
  const [changesJudgment, setChangesJudgment] = useState(false);
  const [affectedStation, setAffectedStation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    newRecords: number;
    newAnomalies: number;
    warnings: string[];
  } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const csvFile = fileList.find(f =>
      f.name.toLowerCase().endsWith('.csv') ||
      f.name.toLowerCase().endsWith('.txt')
    );

    if (!csvFile) {
      setUploadResult({
        success: false,
        message: '请上传 CSV 或 TXT 格式的文件',
        newRecords: 0,
        newAnomalies: 0,
        warnings: [],
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadCSV(csvFile, selectedSource);
      detectAnomalies();

      setUploadResult({
        success: true,
        message: `成功导入材料「${result.material.name}」`,
        newRecords: result.parseResult.records.length,
        newAnomalies: result.newAnomalies,
        warnings: result.parseResult.warnings,
      });
    } catch (err) {
      setUploadResult({
        success: false,
        message: err instanceof Error ? err.message : '文件解析失败',
        newRecords: 0,
        newAnomalies: 0,
        warnings: [],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleSaveVerbalNote = () => {
    if (!verbalContent.trim()) return;

    const stationsToApply = affectedStation ? [affectedStation] : undefined;
    const result = addVerbalNote(verbalContent, stationsToApply, changesJudgment);

    setUploadResult({
      success: true,
      message: `已保存口头说明「${result.material.name}」`,
      newRecords: 0,
      newAnomalies: result.newAnomalies,
      warnings: result.parseResult.warnings,
    });

    setVerbalContent('');
    setChangesJudgment(false);
    setAffectedStation('');
  };

  const handleDownloadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '海洋牧场水质检测_示例.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    lab_result: 'border-l-ocean-400 bg-ocean-50/60',
    late_attachment: 'border-l-orange-400 bg-orange-50/60',
    verbal_note: 'border-l-purple-400 bg-purple-50/60',
  };

  const totalRecords = materials.reduce((sum, m) => sum + m.parsedData.length, 0);
  const pendingAnomalies = anomalies.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ocean-800">材料导入</h2>
          <p className="text-sm text-ocean-500 mt-1">
            上传实验室结果表、晚到附件或记录口头说明。系统自动解析并检测异常
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadSample}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            下载示例CSV
          </button>
          <button
            onClick={resetToMockData}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            重置示例数据
          </button>
          {pendingAnomalies > 0 && (
            <button
              onClick={() => navigate('/review')}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              前往复核
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '已上传材料', value: materials.length, icon: Layers, color: 'text-ocean-600', bg: 'bg-ocean-100' },
          { label: '数据总记录', value: totalRecords, icon: FileText, color: 'text-ocean-600', bg: 'bg-ocean-100' },
          { label: '异常总数', value: anomalies.length, icon: AlertTriangle, color: 'text-alert-orange', bg: 'bg-alert-orange/10' },
          { label: '待补证据', value: pendingAnomalies, icon: Gauge, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="card-base card-hover p-4 animate-fade-in-up stagger-1" style={{ opacity: 0, animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ocean-600">{item.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${item.bg}`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {uploadResult && (
        <div className={`p-4 rounded-lg border-l-4 animate-slide-in-right ${
          uploadResult.success
            ? 'bg-alert-green/5 border-alert-green/30'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-start gap-3">
            {uploadResult.success ? (
              <CheckCircle className="w-5 h-5 text-alert-green flex-shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${uploadResult.success ? 'text-alert-green' : 'text-red-600'}`}>
                {uploadResult.message}
              </p>
              {(uploadResult.newRecords > 0 || uploadResult.newAnomalies > 0) && (
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-ocean-600">
                    <FileText className="w-3 h-3 inline mr-1" />
                    {uploadResult.newRecords} 条数据记录
                  </span>
                  <span className={uploadResult.newAnomalies > 0 ? 'text-alert-orange font-medium' : 'text-ocean-500'}>
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {uploadResult.newAnomalies > 0 ? `新增 ${uploadResult.newAnomalies} 条异常` : '未触发新异常'}
                  </span>
                </div>
              )}
              {uploadResult.warnings.length > 0 && (
                <div className="mt-2 p-2 bg-white/60 rounded-md">
                  <p className="text-xs font-medium text-amber-700 mb-1">⚠️ 解析警告：</p>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {uploadResult.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={() => setUploadResult(null)}
              className="p-1 text-ocean-400 hover:text-ocean-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                      {source === 'late_attachment' && '后续补充的CSV数据'}
                      {source === 'verbal_note' && '口头说明或文字备注'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedSource !== 'verbal_note' ? (
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
              <div className="flex flex-col items-center justify-center py-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                  isDragging
                    ? 'bg-ocean-500 text-white animate-pulse'
                    : uploading
                    ? 'bg-ocean-100 text-ocean-500'
                    : 'bg-ocean-100 text-ocean-500'
                }`}>
                  {uploading ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-ocean-800 mb-1">
                  {uploading ? '正在解析文件...' : '拖拽文件到这里上传'}
                </h3>
                <p className="text-sm text-ocean-500 mb-4">
                  支持 CSV、TXT 格式，或点击下方按钮选择文件
                </p>
                <div className="flex items-center gap-3">
                  <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
                    <FilePlus className="w-4 h-4" />
                    选择文件
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </label>
                  <button
                    onClick={handleDownloadSample}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    查看示例
                  </button>
                </div>

                <div className="mt-6 p-4 bg-ocean-50/60 rounded-md w-full max-w-lg">
                  <p className="text-xs font-medium text-ocean-700 mb-2">📋 CSV 文件应包含以下列：</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {['点位名称', '采样时间', '实验时间', '水温', '盐度', '潮位', '潮位单位', '溶解氧', 'pH'].map(col => (
                      <span key={col} className="px-2 py-1 bg-white rounded border border-ocean-200 text-ocean-600">
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-ocean-500 mt-2">列名可灵活识别（如水温/温度/temp均支持）</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-base p-5 border-l-4 border-purple-400">
              <h3 className="text-sm font-semibold text-ocean-700 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                记录口头说明
              </h3>
              <textarea
                value={verbalContent}
                onChange={(e) => setVerbalContent(e.target.value)}
                placeholder="请输入口头说明内容：&#10;例如：&#10;- 南湾监测点溶解氧偏低是因为近期赤潮影响&#10;- 东港2号站潮位数据已重新检测，统一为米单位&#10;- 某条记录数据确实异常，建议剔除不纳入公示"
                className="w-full h-40 p-3 border border-ocean-200 rounded-md text-sm
                           focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-300
                           resize-none placeholder:text-ocean-400"
              />

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-ocean-600 whitespace-nowrap w-28">影响点位：</label>
                  <select
                    value={affectedStation}
                    onChange={(e) => setAffectedStation(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-ocean-200 rounded-md bg-white
                               focus:outline-none focus:border-ocean-400"
                  >
                    <option value="">（可选）自动识别内容中的点位关键词</option>
                    {stations.map(s => (
                      <option key={s.id} value={s.id}>{s.id} - {s.name}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={changesJudgment}
                    onChange={(e) => setChangesJudgment(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-ocean-300 text-ocean-600 focus:ring-ocean-400"
                  />
                  <div>
                    <span className="text-sm text-ocean-700 font-medium group-hover:text-ocean-800">
                      ⚠️ 本说明改变了原来的判断口径
                    </span>
                    <p className="text-xs text-ocean-500 mt-0.5">
                      勾选后，本说明会写入相关异常的证据链，并标注"口径变更"
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end mt-5 pt-4 border-t border-ocean-100">
                <button
                  onClick={handleSaveVerbalNote}
                  disabled={!verbalContent.trim()}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  保存说明并写入材料库
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ocean-700 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              材料时间线
            </h3>
            <span className="text-xs text-ocean-500">共 {materials.length} 份</span>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin pr-1">
            {sortedMaterials.map((material, index) => {
              const Icon = sourceIcons[material.source];
              return (
                <div
                  key={material.id}
                  className={`card-base card-hover p-4 border-l-4 ${sourceColors[material.source]} animate-fade-in-up`}
                  style={{ opacity: 0, animationDelay: `${index * 60}ms` }}
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
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-ocean-800 text-sm truncate">
                          {material.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <SourceTypeBadge source={material.source} />
                          <span className="text-xs text-ocean-500">v{material.version}</span>
                          {material.isLatest && (
                            <span className="text-xs text-alert-green font-medium flex items-center gap-0.5">
                              <Sparkles className="w-3 h-3" />最新
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ocean-400 flex-shrink-0" />
                  </div>

                  <div className="mt-3 pt-3 border-t border-ocean-100/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-ocean-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{material.uploadTime}</span>
                    </div>
                    {material.parsedData.length > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-ocean-500">
                          <FileText className="w-3.5 h-3.5" />
                          {material.parsedData.length} 条记录
                        </span>
                        <span className="flex items-center gap-1 text-ocean-500">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {anomalies.filter(a => a.materialIds.includes(material.id)).length} 条关联异常
                        </span>
                      </div>
                    )}
                    {material.description && (
                      <p className="text-xs text-ocean-600 line-clamp-2 pt-1 border-t border-ocean-100/40 mt-2">
                        💬 {material.description}
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
                    {material.source === 'verbal_note' && (
                      <span className="text-xs text-purple-600 ml-auto flex items-center gap-1">
                        💬 口头说明
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
                <p className="text-xs font-medium text-ocean-700">使用流程</p>
                <ol className="text-xs text-ocean-500 mt-1 space-y-0.5 list-decimal pl-4">
                  <li>上传实验室结果表（CSV）</li>
                  <li>补充晚到附件或修正数据</li>
                  <li>记录口头说明（可标记口径变更）</li>
                  <li>前往"异常检测"查看问题清单</li>
                  <li>在"复核汇总"确认证据并导出报告</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
