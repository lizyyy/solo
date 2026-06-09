import type {
  InspectionRecord,
  AnomalyInfo,
  Conclusion,
  PersistedNote,
} from '../types';
import { ANOMALY_LABELS } from '../dataService';
import { useState } from 'react';

interface Props {
  records: InspectionRecord[];
  anomalies: AnomalyInfo[];
  conclusions: Conclusion[];
  notes: Record<string, PersistedNote>;
  onNoteChange: (recordId: string, content: string) => void;
  highlightRecordId?: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  normal: 'row-normal',
  warning: 'row-warning',
  critical: 'row-critical',
  missing: 'row-missing',
};

const STATUS_TEXT: Record<string, string> = {
  normal: '正常',
  warning: '预警',
  critical: '超限',
  missing: '断档',
};

export default function RecordTable({
  records,
  anomalies,
  conclusions,
  notes,
  onNoteChange,
  highlightRecordId,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const anomalyMap = new Map<string, AnomalyInfo[]>();
  for (const a of anomalies) {
    anomalyMap.set(a.recordId, [...(anomalyMap.get(a.recordId) || []), a]);
  }
  const conclMap = new Map<string, Conclusion[]>();
  for (const c of conclusions) {
    for (const rid of c.affectedRecords) {
      conclMap.set(rid, [...(conclMap.get(rid) || []), c]);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>巡检明细（线索可追溯）</h3>
        <span className="muted">共 {records.length} 条 · 点击行查看异常证据 & 关联结论</span>
      </div>
      <div className="table-wrap">
        <table className="rec-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>塔吊</th>
              <th>部件</th>
              <th>类别</th>
              <th>实测值</th>
              <th>阈值区间</th>
              <th>状态</th>
              <th>巡检员</th>
              <th>异常标签</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const anoms = anomalyMap.get(r.id) || [];
              const concls = conclMap.get(r.id) || [];
              const isHL = highlightRecordId === r.id;
              const isOpen = expanded === r.id;
              return (
                <>
                  <tr
                    key={r.id}
                    className={`${STATUS_CLASS[r.status]} ${isHL ? 'row-highlight' : ''} ${isOpen ? 'row-open' : ''}`}
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <td>{r.date}</td>
                    <td>{r.craneName}</td>
                    <td>{r.partName}</td>
                    <td>{r.partCategory}</td>
                    <td>
                      {r.measuredValue === null ? (
                        <em className="muted">未采集</em>
                      ) : (
                        <>
                          {r.measuredValue}
                          <span className="unit">{r.unit}</span>
                        </>
                      )}
                    </td>
                    <td className="muted">
                      [{r.thresholdMin}, {r.thresholdMax}] {r.unit}
                    </td>
                    <td>
                      <span className={`badge badge-${r.status}`}>{STATUS_TEXT[r.status]}</span>
                    </td>
                    <td>{r.inspector}</td>
                    <td>
                      {anoms.length ? (
                        <div className="anom-tags">
                          {anoms.map((a, i) => (
                            <span key={i} className={`anom-tag anom-${a.type}`}>
                              {ANOMALY_LABELS[a.type]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        className="note-input"
                        placeholder="填写现场备注…"
                        value={notes[r.id]?.content || ''}
                        onChange={(e) => onNoteChange(r.id, e.target.value)}
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={r.id + '-exp'} className="row-expand">
                      <td colSpan={10}>
                        <div className="expand-inner">
                          <div className="expand-col">
                            <h4>异常证据</h4>
                            {anoms.length ? (
                              anoms.map((a, i) => (
                                <div key={i} className="evid-block">
                                  <div className={`evid-title evid-${a.severity}`}>
                                    [{ANOMALY_LABELS[a.type]}] {a.description}
                                  </div>
                                  <ul>
                                    {a.evidence.map((e, j) => (
                                      <li key={j}>{e}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))
                            ) : (
                              <div className="muted">本记录无异常。</div>
                            )}
                          </div>
                          <div className="expand-col">
                            <h4>关联结论 / 排程影响</h4>
                            {concls.length ? (
                              concls.map((c) => (
                                <div key={c.id} className="concl-block">
                                  <div className="concl-title">{c.title}</div>
                                  <div className="concl-detail">{c.detail}</div>
                                  {c.deltaNote && (
                                    <div className="concl-delta">⚠ 结论变化说明：{c.deltaNote}</div>
                                  )}
                                  <div className="concl-meta muted">
                                    结论ID：{c.id} · 批次：{c.batchId}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="muted">未关联到任何结论。</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
