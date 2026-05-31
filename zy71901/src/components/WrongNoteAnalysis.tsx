import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  Users,
  Mic,
} from 'lucide-react';
import type { WrongNoteRecord } from '../types';
import {
  formatTime,
  getSourceLabel,
  getStatusLabel,
  getStatusColor,
  getAnalysisResultLabel,
  formatDate,
} from '../utils/analysis';

interface Props {
  records: WrongNoteRecord[];
}

export default function WrongNoteAnalysis({ records }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(records[0]?.id || null);

  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return records;
    return records.filter((r) => r.status === statusFilter);
  }, [records, statusFilter]);

  const sourceIcons: Record<string, React.ReactNode> = {
    recording: <Mic size={14} />,
    section_leader: <Users size={14} />,
    metronome: <Clock size={14} />,
  };

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>钢琴陪练错音分析</h2>
        <span className="badge badge-warning">共 {filteredRecords.length} 条问题</span>
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          全部
        </button>
        <button
          className={`filter-btn ${statusFilter === 'confirmed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('confirmed')}
        >
          <CheckCircle size={14} style={{ marginRight: 4 }} />
          已确认
        </button>
        <button
          className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <Clock size={14} style={{ marginRight: 4 }} />
          待补充
        </button>
        <button
          className={`filter-btn ${statusFilter === 'corrected' ? 'active' : ''}`}
          onClick={() => setStatusFilter('corrected')}
        >
          <User size={14} style={{ marginRight: 4 }} />
          人工更正
        </button>
      </div>

      <div className="wrong-note-list">
        {filteredRecords.map((record) => (
          <div key={record.id} className="wrong-note-card">
            <div className="wrong-note-header">
              <div>
                <div className="wrong-note-title">
                  {getAnalysisResultLabel(record.autoAnalysis?.result || 'other')}
                  <span
                    className="badge"
                    style={{
                      marginLeft: 8,
                      backgroundColor: getStatusColor(record.status) + '20',
                      color: getStatusColor(record.status),
                    }}
                  >
                    {getStatusLabel(record.status)}
                  </span>
                </div>
                <div className="wrong-note-location">
                  第 {record.measureNumber} 小节 第 {record.beatNumber} 拍 · {formatTime(record.timestamp - (records[0]?.timestamp || 0))}
                  <span style={{ marginLeft: 8, marginRight: 4 }}>
                    {sourceIcons[record.source]}
                  </span>
                  来源：{getSourceLabel(record.source)}
                </div>
              </div>
              <button className="icon-btn" onClick={() => toggleExpand(record.id)}>
                {expandedId === record.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            <div className="wrong-note-body">
              <div className="wrong-note-detail">
                <div>
                  <label>预期音高/时值</label>
                  <div className="expected">{record.expectedNote}</div>
                </div>
                <div>
                  <label>实际音高/时值</label>
                  <div className="actual">{record.actualNote}</div>
                </div>
              </div>

              {record.keyMismatchInfo && (
                <div className="key-mismatch">
                  <h5>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                    转调不同步警告
                  </h5>
                  <div className="key-mismatch-row">
                    <label>预期调号：</label>
                    <span>{record.keyMismatchInfo.expectedKey}</span>
                  </div>
                  <div className="key-mismatch-row">
                    <label>实际调号：</label>
                    <span>{record.keyMismatchInfo.actualKey}</span>
                  </div>
                  <div className="key-mismatch-row">
                    <label>问题来源：</label>
                    <span>{getSourceLabel(record.keyMismatchInfo.mismatchSource)}</span>
                  </div>
                  <div className="key-mismatch-row">
                    <label>对接人员：</label>
                    <span>{record.keyMismatchInfo.followUpContact}</span>
                  </div>
                </div>
              )}

              {record.manualCorrection && (
                <div className="manual-correction">
                  <h5>
                    <User size={14} style={{ display: 'inline', marginRight: 6 }} />
                    人工更正记录
                  </h5>
                  <div className="correction-row">
                    <label>更正人</label>
                    <div>{record.manualCorrection.correctedBy} · {formatDate(record.manualCorrection.correctedAt)}</div>
                  </div>
                  <div className="correction-row">
                    <label>原始内容</label>
                    <div className="correction-original">{record.manualCorrection.originalContent}</div>
                  </div>
                  <div className="correction-row">
                    <label>更正后内容</label>
                    <div className="correction-new">{record.manualCorrection.correctedContent}</div>
                  </div>
                  <div className="correction-row">
                    <label>更正理由</label>
                    <div className="correction-new">{record.manualCorrection.correctionReason}</div>
                  </div>
                </div>
              )}
            </div>

            {expandedId === record.id && record.autoAnalysis && (
              <div className="analysis-section">
                <h5>
                  <Zap size={14} />
                  自动分析详情
                  <span className="badge badge-info" style={{ marginLeft: 8 }}>
                    置信度 {(record.autoAnalysis.confidence * 100).toFixed(0)}%
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                    分析器 v{record.autoAnalysis.analyzerVersion} · {formatDate(record.autoAnalysis.analysisTime)}
                  </span>
                </h5>

                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${record.autoAnalysis.confidence * 100}%` }}
                  />
                </div>

                <h5 style={{ marginTop: 16 }}>
                  <FileText size={14} />
                  判断理由
                </h5>
                <ul className="reasons-list">
                  {record.autoAnalysis.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>

                <h5 style={{ marginTop: 16 }}>
                  <AlertTriangle size={14} />
                  分析证据
                </h5>
                <div className="evidence-list">
                  {record.autoAnalysis.evidence.map((ev, idx) => (
                    <div key={idx} className="evidence-item">
                      <div className="evidence-type">{ev.type.replace(/_/g, ' ')}</div>
                      <div className="evidence-desc">{ev.description}</div>
                      <div className="evidence-source">
                        证据来源：{getSourceLabel(ev.source)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="next-step">
                  <label>下一步处理</label>
                  <p>{record.nextStep}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div className="empty-state">暂无符合条件的错音记录</div>
      )}
    </div>
  );
}
