import { useMemo } from 'react';
import {
  CheckCircle,
  Clock,
  User,
  AlertTriangle,
  FileText,
  Users,
  Mic,
} from 'lucide-react';
import type { TimelineRecord, WrongNoteRecord } from '../types';
import {
  generateRehearsalSummary,
  getSourceLabel,
  getAnalysisResultLabel,
} from '../utils/analysis';

interface Props {
  timelineRecords: TimelineRecord[];
  wrongNoteRecords: WrongNoteRecord[];
}

export default function RehearsalSummary({ timelineRecords, wrongNoteRecords }: Props) {
  const summary = useMemo(
    () => generateRehearsalSummary(timelineRecords, wrongNoteRecords),
    [timelineRecords, wrongNoteRecords]
  );

  const sourceIcons: Record<string, React.ReactNode> = {
    recording: <Mic size={12} />,
    section_leader: <Users size={12} />,
    metronome: <Clock size={12} />,
  };

  function renderRecordItem(record: WrongNoteRecord) {
    return (
      <div
        key={record.id}
        style={{
          padding: 16,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14, marginBottom: 4 }}>
              {getAnalysisResultLabel(record.autoAnalysis?.result || 'other')}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              第 {record.measureNumber} 小节 第 {record.beatNumber} 拍
              <span style={{ marginLeft: 8, marginRight: 4 }}>
                {sourceIcons[record.source]}
              </span>
              {getSourceLabel(record.source)}
            </div>
          </div>
          <span
            className="badge"
            style={{
              backgroundColor: record.autoAnalysis?.confidence && record.autoAnalysis.confidence > 0.8
                ? '#d1fae5'
                : record.autoAnalysis?.confidence && record.autoAnalysis.confidence > 0.6
                ? '#fef3c7'
                : '#fee2e2',
              color: record.autoAnalysis?.confidence && record.autoAnalysis.confidence > 0.8
                ? '#065f46'
                : record.autoAnalysis?.confidence && record.autoAnalysis.confidence > 0.6
                ? '#92400e'
                : '#991b1b',
            }}
          >
            置信度 {record.autoAnalysis ? (record.autoAnalysis.confidence * 100).toFixed(0) : '--'}%
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: '#64748b' }}>预期：</span>
            <span style={{ color: '#10b981', fontWeight: 500 }}>{record.expectedNote}</span>
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: '#64748b' }}>实际：</span>
            <span style={{ color: '#ef4444', fontWeight: 500 }}>{record.actualNote}</span>
          </div>
        </div>

        {record.keyMismatchInfo && (
          <div style={{ padding: 10, background: '#fef3c7', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, color: '#d97706' }} />
            <strong style={{ color: '#92400e' }}>转调不同步：</strong>
            <span style={{ color: '#92400e' }}>
              来源{getSourceLabel(record.keyMismatchInfo.mismatchSource)}，
              对接：{record.keyMismatchInfo.followUpContact}
            </span>
          </div>
        )}

        {record.manualCorrection && (
          <div style={{ padding: 10, background: '#ede9fe', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
            <User size={12} style={{ display: 'inline', marginRight: 4, color: '#7c3aed' }} />
            <strong style={{ color: '#5b21b6' }}>{record.manualCorrection.correctedBy} 更正：</strong>
            <span style={{ color: '#5b21b6' }}>{record.manualCorrection.correctionReason}</span>
          </div>
        )}

        <div style={{ padding: 10, background: '#eff6ff', borderRadius: 6, fontSize: 12 }}>
          <FileText size={12} style={{ display: 'inline', marginRight: 4, color: '#4f46e5' }} />
          <strong style={{ color: '#3730a3' }}>下一步：</strong>
          <span style={{ color: '#3730a3' }}>{record.nextStep}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>排练小结 - {summary.rehearsalDate}</h2>
          <span className="badge badge-info">共 {summary.totalRecords} 条原始记录</span>
        </div>

        <div className="summary-stats">
          <div className="stat-card">
            <div className="stat-value">{summary.totalRecords}</div>
            <div className="stat-label">原始记录总数</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{summary.confirmedCount}</div>
            <div className="stat-label">已确认问题</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{summary.pendingCount}</div>
            <div className="stat-label">待补充确认</div>
          </div>
          <div className="stat-card info">
            <div className="stat-value">{summary.correctedCount}</div>
            <div className="stat-label">人工更正</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-value">{summary.wrongNoteCount}</div>
            <div className="stat-label">错音问题</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{summary.keyMismatchCount}</div>
            <div className="stat-label">转调不同步</div>
          </div>
        </div>

        <div className="policy-section">
          <h3>
            <FileText size={16} style={{ display: 'inline', marginRight: 6 }} />
            处理口径
          </h3>
          <p>{summary.processingPolicy}</p>
        </div>
      </div>

      <div className="card">
        <div className="summary-section success">
          <h3>
            <CheckCircle size={18} />
            已确认问题
            <span className="count">{summary.confirmedCount} 条</span>
          </h3>
          {summary.confirmedRecords.length > 0 ? (
            summary.confirmedRecords.map(renderRecordItem)
          ) : (
            <div className="empty-state">暂无已确认的问题</div>
          )}
        </div>

        <div className="summary-section warning">
          <h3>
            <Clock size={18} />
            待补充确认
            <span className="count">{summary.pendingCount} 条</span>
          </h3>
          {summary.pendingRecords.length > 0 ? (
            summary.pendingRecords.map(renderRecordItem)
          ) : (
            <div className="empty-state">暂无待补充的问题</div>
          )}
        </div>

        <div className="summary-section info">
          <h3>
            <User size={18} />
            人工更正记录
            <span className="count">{summary.correctedCount} 条</span>
          </h3>
          {summary.correctedRecords.length > 0 ? (
            summary.correctedRecords.map(renderRecordItem)
          ) : (
            <div className="empty-state">暂无人工更正的记录</div>
          )}
        </div>
      </div>
    </div>
  );
}
