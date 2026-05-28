import { useState, useCallback } from 'react';
import { 
  LayoutGrid, Database, FileText, Download, RefreshCw, 
  AlertTriangle, TrendingUp, ShieldCheck, MapPin, 
  Database as DatabaseIcon, Lightbulb, Camera, FileBarChart
} from 'lucide-react';
import { useMainStore } from '@/store/mainStore';
import { generateReport, exportToPDF } from '@/utils/exporters/report';
import { captureScene } from '@/utils/exporters/screenshot';
import type { ProtectionReport, RiskSeverity } from '@/types';
import { SEVERITY_COLORS, RISK_COLORS } from '@/types';

const SEV = { critical: '严重', high: '高', medium: '中', low: '低' };
const RISK = { over_illumination: '照度超标', cumulative_leak: '累积曝光泄漏', light_penetration: '光线穿透' };
const TABS = [
  { key: 'summary', label: '风险统计', icon: TrendingUp },
  { key: 'spatial', label: '空间关系', icon: MapPin },
  { key: 'trace', label: '数据溯源', icon: DatabaseIcon },
  { key: 'recommendations', label: '保护建议', icon: ShieldCheck },
];

export default function ReportPreview() {
  const store = useMainStore();
  const [report, setReport] = useState<ProtectionReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'spatial' | 'trace' | 'recommendations'>('summary');

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const sceneEl = document.getElementById('scene-preview');
      const shots = sceneEl ? [await captureScene(sceneEl)] : [];
      const newReport = generateReport(store.risks, store.artworks, store.lightSources, store.gallery, store.currentExhibition, shots);
      store.addReport(newReport);
      setReport(newReport);
    } catch (e) {
      console.error('生成报告失败:', e);
    } finally {
      setIsGenerating(false);
    }
  }, [store]);

  const handleExportPDF = useCallback(async () => {
    if (!report) return;
    setIsExporting(true);
    try { await exportToPDF(report); } 
    catch (e) { console.error('导出PDF失败:', e); } 
    finally { setIsExporting(false); }
  }, [report]);

  const navigate = (p: string) => { window.location.href = p; };

  const renderRiskChart = () => {
    if (!report) return null;
    const { bySeverity } = report.riskSummary;
    const total = Object.values(bySeverity).reduce((a, b) => a + b, 0);
    return (
      <div className="space-y-3">
        {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
          const count = bySeverity[sev];
          const percent = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={sev}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text-secondary)]">{SEV[sev]}</span>
                <span className="font-medium">{count} 项 ({percent.toFixed(1)}%)</span>
              </div>
              <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: SEVERITY_COLORS[sev] }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRiskTypeChart = () => {
    if (!report) return null;
    const { overIllumination, cumulativeLeak, lightPenetration } = report.riskSummary;
    const types = [
      { key: 'over_illumination', label: RISK.over_illumination, count: overIllumination },
      { key: 'cumulative_leak', label: RISK.cumulative_leak, count: cumulativeLeak },
      { key: 'light_penetration', label: RISK.light_penetration, count: lightPenetration },
    ];
    return (
      <div className="grid grid-cols-3 gap-4">
        {types.map(t => (
          <div key={t.key} className="card p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: RISK_COLORS[t.key as keyof typeof RISK_COLORS] }}>{t.count}</div>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">{t.label}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderSpatial = () => (
    <div className="space-y-6">
      <div id="scene-preview" className="h-64 bg-gradient-to-b from-[#1a1a25] to-[#0a0a0f] rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <div className="text-[var(--color-text-secondary)]">空间关系图预览区域</div>
          <div className="text-sm text-[var(--color-text-muted)] mt-1">展示作品、光源、风险点的空间分布</div>
        </div>
      </div>
      <div className="card p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-400" />空间坐标说明</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { color: 'bg-blue-500', axis: 'X轴', desc: '展厅宽度方向，向右为正' },
            { color: 'bg-green-500', axis: 'Y轴', desc: '展厅高度方向，向上为正' },
            { color: 'bg-red-500', axis: 'Z轴', desc: '展厅深度方向，向前为正' },
            { color: 'bg-yellow-500', axis: '原点', desc: '展厅地面中心 (0,0,0)' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className={`w-3 h-3 rounded-full ${item.color} mt-1 flex-shrink-0`} />
              <div><div className="font-medium">{item.axis}</div><div className="text-[var(--color-text-tertiary)]">{item.desc}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400" />风险点空间分布</h4>
        <div className="space-y-2">
          {store.risks.slice(0, 5).map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 bg-[var(--color-bg-tertiary)] rounded">
              <div className="flex items-center gap-3">
                <span className={`badge badge-${r.severity}`}>{SEV[r.severity as RiskSeverity]}</span>
                <span className="text-sm">{RISK[r.type as keyof typeof RISK]}</span>
              </div>
              <span className="text-xs text-[var(--color-text-tertiary)]">({r.posX.toFixed(1)}, {r.posY.toFixed(1)}, {r.posZ.toFixed(1)})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTrace = () => {
    if (!report) return null;
    return (
      <div className="space-y-4">
        {report.dataSources.map((s, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><DatabaseIcon className="w-4 h-4 text-blue-400" /><span className="font-medium">{s.type}</span></div>
              <span className="text-sm text-[var(--color-text-secondary)]">{s.count} 条记录</span>
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)]">最后更新: {new Date(s.lastUpdated).toLocaleString('zh-CN')}</div>
          </div>
        ))}
        {report.screenshots.length > 0 && (
          <div className="card p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2"><Camera className="w-4 h-4 text-purple-400" />截图证据 ({report.screenshots.length})</h4>
            <div className="grid grid-cols-2 gap-3">
              {report.screenshots.map((shot, i) => (
                <div key={i} className="space-y-2">
                  <img src={shot.dataUrl} alt={shot.caption} className="w-full rounded border border-[var(--color-border)]" />
                  <p className="text-xs text-[var(--color-text-tertiary)]">{shot.caption}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!report) return null;
    return (
      <div className="space-y-3">
        {report.recommendations.map((rec, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${rec.priority === 'high' ? 'text-red-400' : rec.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'}`} />
                <span className="font-medium">{rec.artworkName || '未知作品'}</span>
              </div>
              <span className={`badge ${rec.priority === 'high' ? 'badge-critical' : rec.priority === 'medium' ? 'badge-medium' : 'badge-low'}`}>
                {rec.priority === 'high' ? '高优先级' : rec.priority === 'medium' ? '中优先级' : '低优先级'}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{rec.suggestion}</p>
          </div>
        ))}
        {report.recommendations.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-green-400" />
            <p>暂无需要处理的风险</p>
          </div>
        )}
      </div>
    );
  };

  const activeTabInfo = TABS.find(t => t.key === activeTab)!;

  if (!report) {
    return (
      <div className="h-screen flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
        <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><FileBarChart className="w-6 h-6 text-purple-400" /><span className="font-semibold text-lg">报告预览</span></div>
            <div className="h-6 w-px bg-[var(--color-border)]" />
            <nav className="flex items-center gap-1">
              <button className="btn btn-ghost" onClick={() => navigate('/')}><LayoutGrid className="w-4 h-4" /> 工作台</button>
              <button className="btn btn-ghost" onClick={() => navigate('/data')}><Database className="w-4 h-4" /> 数据管理</button>
              <button className="btn btn-primary"><FileText className="w-4 h-4" /> 报告预览</button>
            </nav>
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />{isGenerating ? '生成中...' : '生成报告'}
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileBarChart className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">暂无报告</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">点击上方"生成报告"按钮创建保护报告</p>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />{isGenerating ? '生成中...' : '生成报告'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
      <header className="h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><FileBarChart className="w-6 h-6 text-purple-400" /><span className="font-semibold text-lg">报告预览</span></div>
          <div className="h-6 w-px bg-[var(--color-border)]" />
          <nav className="flex items-center gap-1">
            <button className="btn btn-ghost" onClick={() => navigate('/')}><LayoutGrid className="w-4 h-4" /> 工作台</button>
            <button className="btn btn-ghost" onClick={() => navigate('/data')}><Database className="w-4 h-4" /> 数据管理</button>
            <button className="btn btn-primary"><FileText className="w-4 h-4" /> 报告预览</button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={handleGenerate} disabled={isGenerating}>
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />{isGenerating ? '生成中...' : '刷新报告'}
          </button>
          <button className="btn btn-primary" onClick={handleExportPDF} disabled={isExporting}>
            <Download className="w-4 h-4" />{isExporting ? '导出中...' : '导出PDF'}
          </button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-56 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex-shrink-0 p-3">
          <div className="card p-4 mb-4">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">报告编号</div>
            <div className="font-mono text-sm">{report.reportNo}</div>
          </div>
          <div className="card p-4 mb-4">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">风险总数</div>
            <div className="text-3xl font-bold text-red-400">{report.riskSummary.totalRisks}</div>
          </div>
          <nav className="space-y-1">
            {TABS.map(tab => (
              <button key={tab.key} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${activeTab === tab.key ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'}`}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">{activeTabInfo.label}</h2>
              {activeTab === 'summary' && (<div className="space-y-6">{renderRiskTypeChart()}<div className="pt-4 border-t border-[var(--color-border)]"><h3 className="font-medium mb-4">严重级别分布</h3>{renderRiskChart()}</div></div>)}
              {activeTab === 'spatial' && renderSpatial()}
              {activeTab === 'trace' && renderTrace()}
              {activeTab === 'recommendations' && renderRecommendations()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
