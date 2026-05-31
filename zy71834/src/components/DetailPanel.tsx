import { useState } from 'react';
import { useAppStore } from '@/store';
import { SourceBadge } from './SourceBadge';
import { AnomalyBadge } from './AnomalyBadge';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  X, FileText, Users, MapPin, AlertTriangle, CheckCircle2,
  ChevronRight, Link2, MessageSquare, Clock, User
} from 'lucide-react';
import type { TestRecord, UnitEntry, TerrainRule, Anomaly, ReviewReport } from '@/types';

export const DetailPanel = () => {
  const {
    selectedRecordId, detailPanelOpen, setDetailPanelOpen,
    testRecords, unitEntries, terrainRules, anomalies, reviewReports,
    confirmAnomaly, unconfirmAnomaly
  } = useAppStore();

  const [operator, setOperator] = useState('策划人员');
  const [remark, setRemark] = useState('');
  const [activeTab, setActiveTab] = useState<'evidence' | 'anomalies' | 'review'>('evidence');

  const selectedRecord = testRecords.find(r => r.id === selectedRecordId);

  if (!detailPanelOpen || !selectedRecord) {
    return null;
  }

  const linkedUnits = unitEntries.filter(u => selectedRecord.linkedUnits.includes(u.id));
  const linkedTerrain = terrainRules.filter(t => selectedRecord.linkedTerrain.includes(t.id));
  const recordAnomalies = anomalies.filter(a => selectedRecord.anomalies.includes(a.id));
  const linkedReviews = reviewReports.filter(r => r.linkedRecordIds.includes(selectedRecord.id));

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-bg-secondary border-l border-border-default shadow-2xl z-50 flex flex-col animate-[slideIn_0.3s_ease-out]">
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">记录详情</h2>
          <p className="text-xs text-text-muted font-mono mt-0.5">{selectedRecord.id}</p>
        </div>
        <button
          onClick={() => setDetailPanelOpen(false)}
          className="p-1.5 hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex border-b border-border-default">
        {[
          { id: 'evidence', label: '证据链', icon: Link2 },
          { id: 'anomalies', label: `异常 (${recordAnomalies.length})`, icon: AlertTriangle },
          { id: 'review', label: `复盘 (${linkedReviews.length})`, icon: MessageSquare },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-accent-military-light border-b-2 border-accent-military'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <SourceBadge type={selectedRecord.sourceType} />
            <span className="text-xs text-text-muted font-mono">
              第{selectedRecord.round}回合 · {format(selectedRecord.timestamp, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
            </span>
          </div>
          <div className="text-base text-text-primary leading-relaxed mb-3">
            {selectedRecord.content}
          </div>
          {selectedRecord.battleReport && (
            <div className="bg-bg-tertiary border border-border-default p-3 mb-2">
              <div className="text-xs text-text-muted mb-1">战报内容</div>
              <div className="text-sm text-text-primary">{selectedRecord.battleReport}</div>
            </div>
          )}
          {selectedRecord.settlementData && (
            <div className="bg-bg-tertiary border border-border-default p-3">
              <div className="text-xs text-text-muted mb-1">结算数据</div>
              <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                {JSON.stringify(selectedRecord.settlementData, null, 2)}
              </pre>
            </div>
          )}
          <div className="text-xs text-text-muted mt-3 font-mono">
            来源文件: {selectedRecord.originalFile}
          </div>
        </div>

        {activeTab === 'evidence' && (
          <EvidenceTab
            record={selectedRecord}
            units={linkedUnits}
            terrain={linkedTerrain}
          />
        )}

        {activeTab === 'anomalies' && (
          <AnomaliesTab
            anomalies={recordAnomalies}
            operator={operator}
            setOperator={setOperator}
            remark={remark}
            setRemark={setRemark}
            onConfirm={confirmAnomaly}
            onUnconfirm={unconfirmAnomaly}
          />
        )}

        {activeTab === 'review' && (
          <ReviewTab reviews={linkedReviews} />
        )}
      </div>
    </div>
  );
};

const EvidenceTab = ({
  record, units, terrain
}: {
  record: TestRecord;
  units: UnitEntry[];
  terrain: TerrainRule[];
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText size={14} />
          测试记录
        </h3>
        <div className="pl-4 border-l-2 border-blue-500/30">
          <div className="bg-bg-tertiary border border-border-default p-3">
            <div className="text-sm text-text-primary">{record.content}</div>
          </div>
        </div>
      </div>

      {units.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users size={14} />
            关联单位 ({units.length})
          </h3>
          <div className="pl-4 border-l-2 border-green-500/30 space-y-2">
            {units.map(unit => (
              <div key={unit.id} className="bg-bg-tertiary border border-border-default p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-semibold text-accent-military-light text-sm">
                    {unit.unitCode}
                  </span>
                  {unit.isManualCorrection && (
                    <span className="badge badge-manual text-[10px]">人工修正</span>
                  )}
                </div>
                <div className="text-sm text-text-primary mb-2">{unit.unitName}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(unit.stats).slice(0, 3).map(([k, v]) => (
                    <div key={k} className="bg-bg-secondary/50 p-1.5">
                      <div className="text-text-muted text-[10px]">{k}</div>
                      <div className="font-mono">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {terrain.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
            <MapPin size={14} />
            关联地形 ({terrain.length})
          </h3>
          <div className="pl-4 border-l-2 border-amber-500/30 space-y-2">
            {terrain.map(t => (
              <div key={t.id} className="bg-bg-tertiary border border-border-default p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-semibold text-amber-400 text-sm">
                    {t.gridPosition}
                  </span>
                  <span className={`badge ${t.passable ? 'badge-normal' : 'badge-pending'} text-[10px]`}>
                    {t.passable ? '可通行' : '不可通行'}
                  </span>
                </div>
                <div className="text-sm text-text-primary">{t.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-text-muted pt-4 border-t border-border-default">
        <ChevronRight size={14} className="text-accent-military" />
        证据链完整，所有引用节点均可追溯
      </div>
    </div>
  );
};

const AnomaliesTab = ({
  anomalies, operator, setOperator, remark, setRemark, onConfirm, onUnconfirm
}: {
  anomalies: Anomaly[];
  operator: string;
  setOperator: (v: string) => void;
  remark: string;
  setRemark: (v: string) => void;
  onConfirm: (id: string, op: string, remark?: string) => void;
  onUnconfirm: (id: string, op: string) => void;
}) => {
  if (anomalies.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted">
        <CheckCircle2 size={48} className="mx-auto mb-3 text-green-600/50" />
        <p>该记录无异常检测</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-bg-tertiary border border-border-default p-3 mb-4">
        <label className="label">确认人员</label>
        <input
          type="text"
          value={operator}
          onChange={e => setOperator(e.target.value)}
          className="input-field"
          placeholder="输入确认人姓名"
        />
      </div>

      {anomalies.map(anomaly => (
        <div
          key={anomaly.id}
          className={`border ${
            anomaly.status === 'pending' ? 'border-accent-warning' : 'border-green-700'
          } bg-bg-tertiary`}
        >
          <div className="p-4 border-b border-border-default">
            <div className="flex items-center justify-between mb-2">
              <AnomalyBadge type={anomaly.type} status={anomaly.status} severity={anomaly.severity} />
              <span className={`text-xs font-mono ${
                anomaly.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {anomaly.severity === 'critical' ? '严重' : '警告'}
              </span>
            </div>
            <div className="text-sm text-text-primary mb-3">{anomaly.description}</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-red-900/20 border border-red-800/50 p-2">
                <div className="text-red-400 font-medium mb-1">期望值</div>
                <div className="text-text-secondary font-mono text-[11px]">{anomaly.evidence.expected}</div>
              </div>
              <div className="bg-green-900/20 border border-green-800/50 p-2">
                <div className="text-green-400 font-medium mb-1">实际值</div>
                <div className="text-text-secondary font-mono text-[11px]">{anomaly.evidence.actual}</div>
              </div>
            </div>
          </div>

          {anomaly.status === 'confirmed' && anomaly.confirmedBy && (
            <div className="px-4 py-2 bg-green-900/20 border-b border-border-default">
              <div className="flex items-center gap-2 text-xs text-green-400">
                <User size={12} />
                {anomaly.confirmedBy} 于 {format(anomaly.confirmedAt!, 'yyyy-MM-dd HH:mm', { locale: zhCN })} 确认
              </div>
              {anomaly.remark && (
                <div className="text-xs text-text-secondary mt-1">备注: {anomaly.remark}</div>
              )}
            </div>
          )}

          <div className="p-3 flex flex-col gap-2">
            {anomaly.status === 'pending' ? (
              <>
                <input
                  type="text"
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  placeholder="确认备注（可选）"
                  className="input-field text-xs"
                />
                <button
                  onClick={() => onConfirm(anomaly.id, operator, remark)}
                  className="btn btn-primary text-xs"
                >
                  <CheckCircle2 size={14} className="inline mr-2" />
                  标记为已确认
                </button>
              </>
            ) : (
              <button
                onClick={() => onUnconfirm(anomaly.id, operator)}
                className="btn text-xs"
              >
                <AlertTriangle size={14} className="inline mr-2" />
                取消确认，恢复待确认状态
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="text-xs text-text-muted p-3 bg-bg-tertiary border border-border-default">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={12} className="text-accent-warning" />
          异常处理规则
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px]">
          <li>边界格穿越、战报结算不一致、回合顺序错误默认标记为待确认</li>
          <li>异常项不会混入正常结果，需人工确认后才可结案</li>
          <li>所有确认操作均会记录操作人和时间</li>
        </ul>
      </div>
    </div>
  );
};

const ReviewTab = ({ reviews }: { reviews: ReviewReport[] }) => {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted">
        <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
        <p>暂无关联复盘报告</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map(review => (
        <div key={review.id} className="bg-bg-tertiary border border-border-default">
          <div className="p-4 border-b border-border-default">
            <h4 className="text-sm font-semibold text-text-primary mb-1">{review.title}</h4>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Clock size={12} />
              {format(review.createdAt, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
            </div>
          </div>
          <div className="p-4">
            <pre className="text-xs text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
              {review.content}
            </pre>
          </div>
          <div className="px-4 py-2 bg-bg-secondary border-t border-border-default">
            <div className="text-xs text-text-muted">
              关联记录: {review.linkedRecordIds.join(', ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
