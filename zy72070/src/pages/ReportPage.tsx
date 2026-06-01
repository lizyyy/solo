import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { generateReport } from '@/utils/guidance';
import { ArrowLeft, Download, Copy, Check, Clock } from 'lucide-react';
import { useState } from 'react';

export function ReportPage() {
  const navigate = useNavigate();
  const { devices, conflicts, decisions, params, project } = useAppStore((state) => ({
    devices: state.devices,
    conflicts: state.conflicts,
    decisions: state.decisions,
    params: state.params,
    project: state.project,
  }));

  const [copied, setCopied] = useState(false);

  const reportContent = generateReport(devices, conflicts, decisions, params);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `地下停车诱导模型报告-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadProject = () => {
    const projectData = {
      project,
      devices,
      conflicts,
      decisions,
      params,
      exportTime: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `地下停车诱导模型方案-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const normalCount = devices.filter(d => d.status === 'normal').length;
  const warningCount = devices.filter(d => d.status === 'warning').length;
  const errorCount = devices.filter(d => d.status === 'error').length;

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="h-14 bg-bg-secondary border-b border-border-subtle flex items-center px-4 gap-4">
        <button
          onClick={() => navigate('/workspace')}
          className="p-2 hover:bg-bg-tertiary rounded transition-colors"
          title="返回工作台"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>

        <h1 className="font-semibold text-text-primary">分析报告</h1>

        <div className="flex-1" />

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-border-subtle rounded text-sm text-text-primary transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4" />}
          {copied ? '已复制' : '复制报告'}
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-border-subtle rounded text-sm text-text-primary transition-colors"
        >
          <Download className="w-4 h-4" />
          导出报告
        </button>

        <button
          onClick={handleDownloadProject}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 rounded text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          导出完整方案
        </button>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-border-subtle bg-bg-secondary p-6 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-text-primary mb-4">方案概览</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">方案名称</span>
                  <span className="text-text-primary">{project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">操作人员</span>
                  <span className="text-text-primary">{project.operator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">创建时间</span>
                  <span className="text-text-primary font-mono text-xs">
                    {new Date(project.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">更新时间</span>
                  <span className="text-text-primary font-mono text-xs">
                    {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-text-primary mb-3">数据统计</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-bg-tertiary rounded-lg text-center">
                  <div className="text-2xl font-bold text-text-primary">{devices.length}</div>
                  <div className="text-xs text-text-muted">设备总数</div>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg text-center">
                  <div className="text-2xl font-bold text-accent-green">{normalCount}</div>
                  <div className="text-xs text-text-muted">正常通过</div>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg text-center">
                  <div className="text-2xl font-bold text-accent-yellow">{warningCount}</div>
                  <div className="text-xs text-text-muted">待确认</div>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg text-center">
                  <div className="text-2xl font-bold text-accent-red">{errorCount}</div>
                  <div className="text-xs text-text-muted">异常</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-text-primary mb-3">判定历史</h3>
              {decisions.length === 0 ? (
                <p className="text-sm text-text-muted">暂无判定记录</p>
              ) : (
                <div className="space-y-3">
                  {decisions.slice().reverse().slice(0, 5).map((decision) => (
                    <div key={decision.id} className="p-3 bg-bg-tertiary rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3 h-3 text-text-muted" />
                        <span className="text-xs text-text-muted">
                          {new Date(decision.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary text-sm">{decision.operator}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          decision.type === 'accept'
                            ? 'bg-accent-green/20 text-accent-green'
                            : decision.type === 'reject'
                            ? 'bg-accent-red/20 text-accent-red'
                            : 'bg-accent-yellow/20 text-accent-yellow'
                        }`}>
                          {decision.type === 'accept' ? '通过' : decision.type === 'reject' ? '驳回' : '人工确认'}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">{decision.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <pre className="whitespace-pre-wrap font-mono text-sm text-text-primary bg-bg-secondary p-6 rounded-lg border border-border-subtle">
              {reportContent}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
