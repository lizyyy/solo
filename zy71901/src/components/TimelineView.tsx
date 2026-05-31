import { useState, useMemo } from 'react';
import { Mic, Users, Timer, Music, Clock, AlertTriangle } from 'lucide-react';
import type { TimelineRecord, RecordingRecord, SectionLeaderNote, MetronomeRecord } from '../types';
import { formatTime, getSourceLabel, getStatusLabel, getStatusColor, detectDuplicates, detectLateArrivals } from '../utils/analysis';

interface Props {
  records: TimelineRecord[];
}

export default function TimelineView({ records }: Props) {
  const [filter, setFilter] = useState<string>('all');

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => a.timestamp - b.timestamp);
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (filter === 'all') return sortedRecords;
    return sortedRecords.filter((r) => r.source === filter);
  }, [sortedRecords, filter]);

  const duplicates = useMemo(() => detectDuplicates(records), [records]);
  const lateArrivals = useMemo(() => detectLateArrivals(records), [records]);

  const sourceIcons: Record<string, React.ReactNode> = {
    recording: <Mic size={14} />,
    section_leader: <Users size={14} />,
    metronome: <Timer size={14} />,
  };

  function renderRecordingContent(record: RecordingRecord) {
    return (
      <div className="timeline-content">
        <h4>{record.segmentName}</h4>
        <p>{record.notes}</p>
        <div className="timeline-meta">
          <span><Music size={12} /> 调号：{record.keySignature}</span>
          <span><Timer size={12} /> 速度：{record.tempo} BPM</span>
          <span><Clock size={12} /> 时长：{record.duration}秒</span>
        </div>
      </div>
    );
  }

  function renderSectionLeaderContent(record: SectionLeaderNote) {
    const isLate = lateArrivals.has(record.id);
    const lateInfo = lateArrivals.get(record.id);
    const isDuplicate = duplicates.has(record.id);
    const dupInfo = duplicates.get(record.id);

    return (
      <div className="timeline-content">
        <h4>
          {record.sectionName} - {record.authorName}
          {record.priority === 'high' && (
            <span className="badge badge-warning" style={{ marginLeft: 8 }}>高优先级</span>
          )}
        </h4>
        <p>{record.content}</p>
        {record.keySignature && (
          <div className="timeline-meta">
            <span><Music size={12} /> 调号：{record.keySignature}</span>
            {record.suggestedTempo && (
              <span><Timer size={12} /> 建议速度：{record.suggestedTempo} BPM</span>
            )}
          </div>
        )}
        {isLate && lateInfo && (
          <div style={{ marginTop: 12, padding: 10, background: '#fce7f3', borderRadius: 6, fontSize: 12, color: '#9d174d' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
            <strong>晚到附件：</strong>
            {lateInfo.reason}
            <br />
            延迟时间：{Math.round(lateInfo.delayMs / 60000)}分钟
          </div>
        )}
        {isDuplicate && dupInfo && (
          <div style={{ marginTop: 12, padding: 10, background: '#f3f4f6', borderRadius: 6, fontSize: 12, color: '#4b5563' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
            <strong>重复项：</strong>
            与记录 {dupInfo.duplicateOfId} 重复，置信度 {(dupInfo.confidence * 100).toFixed(0)}%
            <br />
            原因：{dupInfo.reasons.join('；')}
          </div>
        )}
      </div>
    );
  }

  function renderMetronomeContent(record: MetronomeRecord) {
    return (
      <div className="timeline-content">
        <h4>节拍器记录</h4>
        <div className="timeline-meta">
          <span><Timer size={12} /> 速度：{record.tempo} BPM</span>
          <span><Music size={12} /> 拍号：{record.beatsPerMeasure}/4</span>
          <span><Clock size={12} /> 时长：{record.duration}秒</span>
          {record.driftAmount !== undefined && (
            <span style={{ color: record.driftAmount > 1 ? '#dc2626' : '#65a30d' }}>
              <AlertTriangle size={12} /> 速度偏移：{record.driftAmount > 0 ? '+' : ''}{record.driftAmount} BPM
            </span>
          )}
        </div>
      </div>
    );
  }

  function renderContent(record: TimelineRecord) {
    switch (record.source) {
      case 'recording':
        return renderRecordingContent(record as RecordingRecord);
      case 'section_leader':
        return renderSectionLeaderContent(record as SectionLeaderNote);
      case 'metronome':
        return renderMetronomeContent(record as MetronomeRecord);
      default:
        return null;
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>排练时间线</h2>
        <span className="badge badge-info">共 {filteredRecords.length} 条记录</span>
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        <button
          className={`filter-btn ${filter === 'recording' ? 'active' : ''}`}
          onClick={() => setFilter('recording')}
        >
          <Mic size={14} style={{ marginRight: 4 }} />
          排练录音
        </button>
        <button
          className={`filter-btn ${filter === 'section_leader' ? 'active' : ''}`}
          onClick={() => setFilter('section_leader')}
        >
          <Users size={14} style={{ marginRight: 4 }} />
          声部长备注
        </button>
        <button
          className={`filter-btn ${filter === 'metronome' ? 'active' : ''}`}
          onClick={() => setFilter('metronome')}
        >
          <Timer size={14} style={{ marginRight: 4 }} />
          节拍器记录
        </button>
      </div>

      <div className="timeline">
        {filteredRecords.map((record) => (
          <div
            key={record.id}
            className={`timeline-item ${record.source} ${record.status}`}
          >
            <div className="timeline-status">
              <span
                className="badge"
                style={{
                  backgroundColor: getStatusColor(record.status) + '20',
                  color: getStatusColor(record.status),
                }}
              >
                {getStatusLabel(record.status)}
              </span>
            </div>
            <div className="timeline-time">
              {formatTime(record.timestamp - sortedRecords[0]?.timestamp || 0)}
            </div>
            <div className={`timeline-source ${record.source}`}>
              {sourceIcons[record.source]}
              {getSourceLabel(record.source)}
            </div>
            {renderContent(record)}
          </div>
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div className="empty-state">暂无符合条件的记录</div>
      )}
    </div>
  );
}
