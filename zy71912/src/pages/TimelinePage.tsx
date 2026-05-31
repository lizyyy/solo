import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timeline } from '@/components/timeline/Timeline';
import { ImportPanel } from '@/components/panels/ImportPanel';
import { AnomalyPanel } from '@/components/panels/AnomalyPanel';
import { HistoryPanel } from '@/components/panels/HistoryPanel';
import { RecordDetailPanel } from '@/components/panels/RecordDetailPanel';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useTimelineStore } from '@/store/useTimelineStore';
import { Upload, AlertTriangle, History, FileText, User, Settings, HelpCircle } from 'lucide-react';
import type { PanelTab } from '@/types';

export function TimelinePage() {
  const navigate = useNavigate();
  const [rightTab, setRightTab] = useState<PanelTab>('anomalies');
  const [showHelp, setShowHelp] = useState(false);

  const anomalies = useTimelineStore(state => state.anomalies);
  const snapshots = useTimelineStore(state => state.snapshots);
  const selectedRecordId = useTimelineStore(state => state.selectedRecordId);
  const operator = useTimelineStore(state => state.operator);
  const setOperator = useTimelineStore(state => state.setOperator);
  const runDetection = useTimelineStore(state => state.runDetection);

  const unresolvedCount = anomalies.filter(a => !a.resolved).length;

  const tabConfig: { id: PanelTab; label: string; icon: typeof Upload; count?: number }[] = [
    { id: 'import', label: '导入', icon: Upload },
    { id: 'anomalies', label: '异常', icon: AlertTriangle, count: unresolvedCount },
    { id: 'history', label: '历史', icon: History, count: snapshots.length },
  ];

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-status-confirmed rounded-none" />
            <span className="text-xs font-medium text-text-primary tracking-widest uppercase">
              播客剪辑时间轴
            </span>
          </div>
          <div className="w-px h-4 bg-border-primary" />
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="bg-transparent border-none text-xs text-text-secondary focus:outline-none focus:text-text-primary w-24"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => runDetection()}>
            <AlertTriangle className="w-4 h-4" />
            重新检测
          </Button>
          <div className="w-px h-5 bg-border-primary" />
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(!showHelp)}>
            <HelpCircle className="w-4 h-4" />
            操作指南
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/export')}>
            <FileText className="w-4 h-4" />
            上线清单
          </Button>
        </div>
      </div>

      {showHelp && (
        <div className="px-4 py-3 border-b border-border-primary bg-status-manual/10 animate-fade-in">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-status-manual flex-shrink-0 mt-0.5" />
            <div className="flex-1 grid grid-cols-3 gap-6 text-xs">
              <div>
                <h4 className="font-medium text-text-primary mb-1">🎙️ 放嘉宾名单样例</h4>
                <p className="text-text-secondary">
                  点击左侧"导入"面板，可粘贴CSV格式数据。样例格式：
                  <code className="block mt-1 code-text text-text-muted bg-bg-tertiary p-1">
                    type,startTime,duration,title,status,meta.speakerName
                    <br />
                    guest,0,180,开场介绍,confirmed,张明
                  </code>
                </p>
              </div>
              <div>
                <h4 className="font-medium text-text-primary mb-1">⚠️ 看时间轴漂移</h4>
                <p className="text-text-secondary">
                  时间轴上橘红色高亮区域即为漂移区。基于统计学标准差检测（偏离均值±2σ），
                  严重程度分低/中/高三级。点击"异常"面板查看详情。
                </p>
              </div>
              <div>
                <h4 className="font-medium text-text-primary mb-1">✅ 导出前复核</h4>
                <p className="text-text-secondary">
                  点击右上角"上线清单"进入预览页，先点"一键复核"检查：
                  未解决异常数、待补记录完整性、人工更正说明、总时长一致性。确认无误后导出。
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)}>
              收起
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border-primary">
          <Timeline />
        </div>

        <div className="w-[420px] flex flex-col bg-bg-secondary">
          <div className="flex border-b border-border-primary">
            {tabConfig.map((tab) => {
              const Icon = tab.icon;
              const isActive = rightTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-bg-primary text-text-primary border-b-2 border-text-primary'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50'
                  }`}
                  onClick={() => setRightTab(tab.id)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <Badge variant={tab.id === 'anomalies' ? 'anomaly' : 'manual'} className="text-[9px] px-1">
                      {tab.count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden flex">
            <div className={`flex-1 ${selectedRecordId ? 'w-1/2 border-r border-border-primary' : 'w-full'}`}>
              {rightTab === 'import' && <ImportPanel />}
              {rightTab === 'anomalies' && <AnomalyPanel />}
              {rightTab === 'history' && <HistoryPanel />}
            </div>
            {selectedRecordId && (
              <div className="w-1/2">
                <RecordDetailPanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
