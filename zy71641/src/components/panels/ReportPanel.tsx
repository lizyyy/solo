import { useState } from 'react';
import { FileText, Download, Camera, CheckCircle, AlertTriangle, History, User, Calendar, Activity } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { getAnomalyTypeLabel, getSeverityLabel } from '@/utils/anomalyDetector';

export function ReportPanel() {
  const { 
    currentSession, 
    activePanel,
    saveSession,
    exportReport,
  } = useSwingStore();
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png'>('pdf');
  const [exportSuccess, setExportSuccess] = useState(false);
  
  if (!currentSession || activePanel !== 'report') return null;
  
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportReport(exportFormat);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleSave = async () => {
    await saveSession();
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };
  
  const stats = {
    totalFrames: currentSession.frames.length,
    anomalies: currentSession.anomalies.length,
    confirmedAnomalies: currentSession.anomalies.filter(a => a.isConfirmed).length,
    keyframes: currentSession.keyframes.length,
    supplements: currentSession.supplements.length,
    versions: currentSession.versions.length,
    maxVelocity: Math.max(...currentSession.frames.map(f => f.velocity)),
    avgVelocity: currentSession.frames.reduce((sum, f) => sum + f.velocity, 0) / currentSession.frames.length,
  };
  
  const velocityKmh = (stats.maxVelocity * 3.6).toFixed(1);
  const avgVelocityKmh = (stats.avgVelocity * 3.6).toFixed(1);
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-golf-yellow" />
        <h2 className="text-lg font-semibold text-golf-text">训练报告</h2>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-golf-green/20 text-golf-green text-xs rounded hover:bg-golf-green/30 transition-colors flex items-center gap-1"
          >
            <CheckCircle className="w-3 h-3" /> 保存
          </button>
        </div>
      </div>
      
      {exportSuccess && (
        <div className="mb-4 p-3 bg-golf-green/10 border border-golf-green/30 rounded-lg animate-fade-in">
          <div className="flex items-center gap-2 text-golf-green text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>操作成功！</span>
          </div>
        </div>
      )}
      
      <div className="bg-golf-bg-light border border-golf-border rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-golf-blue" />
          <span className="text-sm font-medium text-golf-text">数据概览</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-golf-bg rounded-lg p-3">
            <div className="text-xs text-golf-text-muted mb-1">学员</div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-golf-blue" />
              <span className="text-sm text-golf-text font-medium">{currentSession.studentName}</span>
            </div>
          </div>
          
          <div className="bg-golf-bg rounded-lg p-3">
            <div className="text-xs text-golf-text-muted mb-1">记录时间</div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-golf-green" />
              <span className="text-sm text-golf-text font-medium">
                {new Date(currentSession.recordedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="bg-golf-bg rounded-lg p-3">
            <div className="text-xs text-golf-text-muted mb-1">最高杆速</div>
            <div className="text-lg font-mono text-golf-green font-bold">
              {velocityKmh} <span className="text-xs text-golf-text-muted">km/h</span>
            </div>
          </div>
          
          <div className="bg-golf-bg rounded-lg p-3">
            <div className="text-xs text-golf-text-muted mb-1">平均杆速</div>
            <div className="text-lg font-mono text-golf-blue font-bold">
              {avgVelocityKmh} <span className="text-xs text-golf-text-muted">km/h</span>
            </div>
          </div>
          
          <div className="bg-golf-bg rounded-lg p-3">
            <div className="text-xs text-golf-text-muted mb-1">数据完整度</div>
            <div className={`text-lg font-mono font-bold ${
              currentSession.dataCompleteness >= 80 ? 'text-golf-green' :
              currentSession.dataCompleteness >= 50 ? 'text-golf-orange' : 'text-golf-red'
            }`}>
              {currentSession.dataCompleteness}%
            </div>
          </div>
          
          <div className="bg-golf-bg rounded-lg p-3">
            <div className="text-xs text-golf-text-muted mb-1">总帧数</div>
            <div className="text-lg font-mono text-golf-purple font-bold">
              {stats.totalFrames}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-golf-bg-light border border-golf-border rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-golf-orange" />
          <span className="text-sm font-medium text-golf-text">异常统计</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-golf-text-muted">检测到异常</span>
            <span className={`font-mono ${stats.anomalies > 0 ? 'text-golf-red' : 'text-golf-green'}`}>
              {stats.anomalies} 个
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-golf-text-muted">已确认异常</span>
            <span className="font-mono text-golf-blue">
              {stats.confirmedAnomalies} 个
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-golf-text-muted">关键帧标注</span>
            <span className="font-mono text-golf-green">
              {stats.keyframes} 个
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-golf-text-muted">补录记录</span>
            <span className="font-mono text-golf-orange">
              {stats.supplements} 条
            </span>
          </div>
        </div>
      </div>
      
      {currentSession.anomalies.length > 0 && (
        <div className="bg-golf-bg-light border border-golf-border rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-golf-red" />
            <span className="text-sm font-medium text-golf-text">异常详情</span>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {currentSession.anomalies.slice(0, 5).map(anomaly => (
              <div 
                key={anomaly.anomalyId}
                className={`p-2 rounded-lg border ${
                  anomaly.isConfirmed 
                    ? 'bg-golf-green/5 border-golf-green/20' 
                    : anomaly.isFalsePositive
                      ? 'bg-golf-text-dim/5 border-golf-text-dim/20'
                      : 'bg-golf-red/5 border-golf-red/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    anomaly.severity === 'high' 
                      ? 'bg-golf-red/20 text-golf-red' 
                      : 'bg-golf-orange/20 text-golf-orange'
                  }`}>
                    {getSeverityLabel(anomaly.severity)}
                  </span>
                  <span className="text-sm text-golf-text">
                    {getAnomalyTypeLabel(anomaly.type)}
                  </span>
                  {anomaly.isConfirmed && (
                    <CheckCircle className="w-3 h-3 text-golf-green ml-auto" />
                  )}
                  {anomaly.isFalsePositive && (
                    <span className="text-xs text-golf-text-muted ml-auto">误报</span>
                  )}
                </div>
                <p className="text-xs text-golf-text-muted mt-1 line-clamp-1">
                  {anomaly.description}
                </p>
              </div>
            ))}
            {currentSession.anomalies.length > 5 && (
              <div className="text-center text-xs text-golf-text-muted">
                还有 {currentSession.anomalies.length - 5} 个异常...
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="bg-golf-bg-light border border-golf-border rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-golf-purple" />
          <span className="text-sm font-medium text-golf-text">版本历史</span>
          <span className="ml-auto text-xs text-golf-text-muted">
            共 {stats.versions} 个版本
          </span>
        </div>
        
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {currentSession.versions.slice(0, 3).map(version => (
            <div 
              key={version.versionId}
              className="p-2 bg-golf-bg rounded-lg border border-golf-border/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-golf-blue">
                  v{version.versionNumber}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  version.changeType === 'create' 
                    ? 'bg-golf-green/20 text-golf-green'
                    : version.changeType === 'update'
                      ? 'bg-golf-blue/20 text-golf-blue'
                      : version.changeType === 'supplement'
                        ? 'bg-golf-orange/20 text-golf-orange'
                        : 'bg-golf-purple/20 text-golf-purple'
                }`}>
                  {version.changeType === 'create' ? '创建' :
                   version.changeType === 'update' ? '更新' :
                   version.changeType === 'supplement' ? '补录' : '导入'}
                </span>
                <span className="text-xs text-golf-text-muted ml-auto">
                  {new Date(version.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-golf-text-muted mt-1">
                {version.remark}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-golf-bg-light border border-golf-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-golf-yellow" />
          <span className="text-sm font-medium text-golf-text">导出报告</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setExportFormat('pdf')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${
                exportFormat === 'pdf'
                  ? 'bg-golf-blue/20 text-golf-blue border border-golf-blue/50'
                  : 'bg-golf-bg text-golf-text-muted border border-golf-border hover:border-golf-border/80'
              }`}
            >
              <FileText className="w-4 h-4" />
              PDF 文档
            </button>
            <button
              onClick={() => setExportFormat('png')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${
                exportFormat === 'png'
                  ? 'bg-golf-green/20 text-golf-green border border-golf-green/50'
                  : 'bg-golf-bg text-golf-text-muted border border-golf-border hover:border-golf-border/80'
              }`}
            >
              <Camera className="w-4 h-4" />
              截图
            </button>
          </div>
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full px-4 py-3 bg-golf-yellow/20 text-golf-yellow rounded-lg hover:bg-golf-yellow/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-golf-yellow/30 border-t-golf-yellow rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出 {exportFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
