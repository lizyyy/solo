import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { getAnomalyTypeLabel, getSourceTypeLabel } from '@/utils/parser';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Download, FileText, AlertTriangle, CheckCircle2, ArrowLeft,
  Copy, FileJson, FileCheck
} from 'lucide-react';

export const ExportPage = () => {
  const navigate = useNavigate();
  const {
    currentMaterialId, materialPacks, testRecords, unitEntries,
    terrainRules, anomalies, reviewReports, confirmationLogs
  } = useAppStore();
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown'>('markdown');
  const [includeRaw, setIncludeRaw] = useState(false);

  const currentPack = materialPacks.find(p => p.id === currentMaterialId);

  if (!currentMaterialId || !currentPack) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 mb-6 flex items-center justify-center border border-border-default bg-bg-tertiary">
          <Download size={40} className="text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">请先选择材料包</h2>
        <p className="text-sm text-text-secondary mb-6">在导入页面加载或上传材料包后导出报告</p>
        <button onClick={() => navigate('/')} className="btn btn-primary">
          <ArrowLeft size={16} className="inline mr-2" />
          前往导入页面
        </button>
      </div>
    );
  }

  const generateMarkdown = (): string => {
    const pending = anomalies.filter(a => a.status === 'pending');
    const confirmed = anomalies.filter(a => a.status === 'confirmed');

    let md = `# 舰队补给棋盘 - 证据链报告\n\n`;
    md += `> 生成时间: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}\n`;
    md += `> 材料包: ${currentPack.name}\n`;
    md += `> 导入时间: ${format(currentPack.importedAt, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}\n\n`;

    md += `## 统计概览\n\n`;
    md += `| 项目 | 数量 |\n|------|------|\n`;
    md += `| 测试记录 | ${testRecords.length} |\n`;
    md += `| 单位条目 | ${unitEntries.length} |\n`;
    md += `| 地形规则 | ${terrainRules.length} |\n`;
    md += `| 待确认异常 | ${pending.length} |\n`;
    md += `| 已确认异常 | ${confirmed.length} |\n`;
    md += `| 复盘报告 | ${reviewReports.length} |\n\n`;

    md += `## 异常检测汇总\n\n`;
    if (anomalies.length === 0) {
      md += `无异常检测。\n\n`;
    } else {
      anomalies.forEach(a => {
        const record = testRecords.find(r => r.id === a.recordId);
        md += `### ${getAnomalyTypeLabel(a.type)} · ${a.status === 'pending' ? '待确认' : '已确认'}\n\n`;
        md += `- **严重程度**: ${a.severity === 'critical' ? '严重' : '警告'}\n`;
        md += `- **关联记录**: ${record?.content || '未知'}\n`;
        md += `- **描述**: ${a.description}\n`;
        md += `- **期望值**: ${a.evidence.expected}\n`;
        md += `- **实际值**: ${a.evidence.actual}\n`;
        if (a.confirmedBy) {
          md += `- **确认人**: ${a.confirmedBy}\n`;
          md += `- **确认时间**: ${a.confirmedAt ? format(a.confirmedAt, 'yyyy-MM-dd HH:mm', { locale: zhCN }) : ''}\n`;
        }
        if (a.remark) {
          md += `- **备注**: ${a.remark}\n`;
        }
        md += `\n---\n\n`;
      });
    }

    md += `## 测试记录明细\n\n`;
    testRecords.forEach(r => {
      md += `### 第${r.round}回合 · ${format(r.timestamp, 'HH:mm', { locale: zhCN })}\n\n`;
      md += `**来源类型**: ${getSourceTypeLabel(r.sourceType)}\n\n`;
      md += `**内容**: ${r.content}\n\n`;
      if (r.battleReport) {
        md += `**战报**: ${r.battleReport}\n\n`;
      }
      if (r.settlementData) {
        md += `**结算数据**:\n\`\`\`json\n${JSON.stringify(r.settlementData, null, 2)}\n\`\`\`\n\n`;
      }
      if (r.anomalies.length > 0) {
        md += `**关联异常**: ${r.anomalies.join(', ')}\n\n`;
      }
      md += `**来源文件**: ${r.originalFile}\n\n`;
    });

    md += `## 单位表\n\n`;
    unitEntries.forEach(u => {
      md += `### ${u.unitCode} · ${u.unitName}\n\n`;
      md += `- 生效回合: ${u.effectiveRound}\n`;
      md += `- 人工修正: ${u.isManualCorrection ? '是' : '否'}\n`;
      md += `- 属性: ${JSON.stringify(u.stats)}\n`;
      md += `- 来源: ${u.source}\n\n`;
    });

    md += `## 地形规则\n\n`;
    terrainRules.forEach(t => {
      md += `### ${t.gridPosition}\n\n`;
      md += `- 类型: ${t.ruleType === 'movement' ? '移动' : t.ruleType === 'combat' ? '战斗' : '补给'}\n`;
      md += `- 描述: ${t.description}\n`;
      md += `- 可通行: ${t.passable ? '是' : '否'}\n`;
      md += `- 生效回合: ${t.effectiveRound}\n`;
      md += `- 来源: ${t.source}\n\n`;
    });

    if (reviewReports.length > 0) {
      md += `## 复盘报告\n\n`;
      reviewReports.forEach(r => {
        md += `### ${r.title}\n\n`;
        md += `> ${format(r.createdAt, 'yyyy-MM-dd HH:mm', { locale: zhCN })}\n\n`;
        md += `${r.content}\n\n`;
        md += `**关联记录**: ${r.linkedRecordIds.join(', ')}\n\n`;
      });
    }

    if (confirmationLogs.length > 0) {
      md += `## 确认日志\n\n`;
      confirmationLogs.forEach(log => {
        md += `- ${format(log.timestamp, 'yyyy-MM-dd HH:mm', { locale: zhCN })} · ${log.operator} · ${log.action === 'confirm' ? '确认' : log.action === 'unconfirm' ? '取消确认' : '添加备注'}`;
        if (log.remark) {
          md += ` · 备注: ${log.remark}`;
        }
        md += `\n`;
      });
    }

    return md;
  };

  const generateJSON = (): string => {
    const data = {
      generatedAt: new Date().toISOString(),
      materialPack: currentPack,
      statistics: {
        testRecords: testRecords.length,
        unitEntries: unitEntries.length,
        terrainRules: terrainRules.length,
        pendingAnomalies: anomalies.filter(a => a.status === 'pending').length,
        confirmedAnomalies: anomalies.filter(a => a.status === 'confirmed').length,
        reviewReports: reviewReports.length,
      },
      anomalies,
      testRecords,
      unitEntries,
      terrainRules,
      reviewReports,
      confirmationLogs,
    };
    return JSON.stringify(data, null, 2);
  };

  const handleExport = () => {
    const content = exportFormat === 'json' ? generateJSON() : generateMarkdown();
    const mimeType = exportFormat === 'json' ? 'application/json' : 'text/markdown';
    const extension = exportFormat === 'json' ? 'json' : 'md';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-supply-report-${format(new Date(), 'yyyyMMdd-HHmmss')}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    const content = exportFormat === 'json' ? generateJSON() : generateMarkdown();
    navigator.clipboard.writeText(content);
  };

  const preview = exportFormat === 'json' ? generateJSON() : generateMarkdown();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate('/timeline')}
              className="p-1.5 hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-xl font-semibold text-text-primary">导出证据链报告</h1>
          </div>
          <p className="text-sm text-text-secondary ml-9">
            {currentPack.name} · 包含完整证据链和异常处理记录
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCopy} className="btn">
            <Copy size={14} className="inline mr-2" />
            复制内容
          </button>
          <button onClick={handleExport} className="btn btn-primary">
            <Download size={14} className="inline mr-2" />
            下载文件
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">导出选项</div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">导出格式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('markdown')}
                  className={`flex-1 btn ${exportFormat === 'markdown' ? 'btn-primary' : ''}`}
                >
                  <FileText size={14} className="inline mr-2" />
                  Markdown
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className={`flex-1 btn ${exportFormat === 'json' ? 'btn-primary' : ''}`}
                >
                  <FileJson size={14} className="inline mr-2" />
                  JSON
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="includeRaw"
                checked={includeRaw}
                onChange={e => setIncludeRaw(e.target.checked)}
                className="w-4 h-4 border-border-default bg-bg-primary text-accent-military focus:ring-accent-military"
              />
              <label htmlFor="includeRaw" className="text-sm text-text-secondary">
                包含原始数据（文件体积更大）
              </label>
            </div>

            <div className="p-4 bg-bg-tertiary border border-border-default">
              <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                <FileCheck size={16} />
                报告内容预览
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">测试记录</span>
                  <span className="text-text-primary font-mono">{testRecords.length} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">单位条目</span>
                  <span className="text-text-primary font-mono">{unitEntries.length} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">地形规则</span>
                  <span className="text-text-primary font-mono">{terrainRules.length} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">异常检测</span>
                  <span className="text-accent-warning-light font-mono">{anomalies.length} 项</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">待确认</span>
                  <span className="text-accent-warning-light font-mono">
                    {anomalies.filter(a => a.status === 'pending').length} 项
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">已确认</span>
                  <span className="text-green-400 font-mono">
                    {anomalies.filter(a => a.status === 'confirmed').length} 项
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">复盘报告</span>
                  <span className="text-text-primary font-mono">{reviewReports.length} 份</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-bg-tertiary border border-border-default">
              <h3 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                <AlertTriangle size={16} className="text-accent-warning-light" />
                异常项处理状态
              </h3>
              {anomalies.length === 0 ? (
                <div className="text-xs text-text-muted">无异常检测</div>
              ) : (
                <div className="space-y-2">
                  {anomalies.map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      {a.status === 'pending' ? (
                        <AlertTriangle size={12} className="text-accent-warning-light" />
                      ) : (
                        <CheckCircle2 size={12} className="text-green-400" />
                      )}
                      <span className="text-text-primary">{getAnomalyTypeLabel(a.type)}</span>
                      <span className="text-text-muted ml-auto">
                        {a.status === 'pending' ? '待确认' : '已确认'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="card-header flex items-center justify-between">
            <span>内容预览</span>
            <span className="text-xs text-text-muted font-mono">
              {exportFormat.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-bg-primary">
            <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
              {preview}
            </pre>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">核心原则</div>
        <div className="card-body text-xs text-text-secondary space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-accent-military">•</span>
            <span>报告包含完整证据链：测试记录 → 单位表 → 地形规则 → 异常检测 → 人工确认 → 复盘结论</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent-warning">•</span>
            <span>异常项（边界格穿越、战报结算不一致、回合顺序错误）始终明确标记，不混入正常结果</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent-military">•</span>
            <span>所有人工确认操作记录操作人和时间，确保可追溯</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent-military">•</span>
            <span>晚到附件、重复项、人工更正的来源均明确标记，接手人员可清楚识别数据来源</span>
          </div>
        </div>
      </div>
    </div>
  );
};
