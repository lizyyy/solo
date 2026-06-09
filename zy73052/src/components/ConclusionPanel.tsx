import type { Conclusion, AnomalyInfo, InspectionRecord } from '../types';
import { ANOMALY_LABELS } from '../dataService';

interface Props {
  conclusions: Conclusion[];
  anomalies: AnomalyInfo[];
  records: InspectionRecord[];
  onDrillToRecord: (recordId: string) => void;
}

export default function ConclusionPanel({
  conclusions,
  anomalies,
  records,
  onDrillToRecord,
}: Props) {
  const byType = new Map<string, AnomalyInfo[]>();
  for (const a of anomalies) {
    byType.set(a.type, [...(byType.get(a.type) || []), a]);
  }

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head">
          <h3>结论与排程建议</h3>
          <span className="muted">从同一份结果生成，与明细一一对应</span>
        </div>
        <div className="concl-list">
          {conclusions.map((c) => (
            <div key={c.id} className="concl-item">
              <div className="concl-item-head">
                <span className="concl-id">{c.id}</span>
                <strong>{c.title}</strong>
              </div>
              <p>{c.detail}</p>
              {c.deltaNote && <div className="delta">⚠ {c.deltaNote}</div>}
              <div className="drill-row">
                <span className="muted">关联记录：</span>
                {c.affectedRecords.slice(0, 8).map((rid) => {
                  const r = records.find((x) => x.id === rid);
                  return (
                    <button
                      key={rid}
                      className="link-btn"
                      onClick={() => onDrillToRecord(rid)}
                      title={r ? `${r.date} ${r.craneName} ${r.partName}` : rid}
                    >
                      {r ? `${r.craneId}/${r.date.slice(5)}` : rid.slice(0, 10)}
                    </button>
                  );
                })}
                {c.affectedRecords.length > 8 && (
                  <span className="muted"> +{c.affectedRecords.length - 8} 条</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>异常单独拎出</h3>
          <span className="muted">采样断档不会被均值盖住</span>
        </div>
        <div className="anom-groups">
          {Array.from(byType.entries()).map(([type, list]) => (
            <div key={type} className="anom-group">
              <div className={`anom-group-head anom-${type}`}>
                {ANOMALY_LABELS[type as keyof typeof ANOMALY_LABELS]} · {list.length} 条
              </div>
              <ul>
                {list.map((a) => {
                  const r = records.find((x) => x.id === a.recordId);
                  return (
                    <li key={a.recordId} className="anom-li">
                      <button className="link-btn" onClick={() => onDrillToRecord(a.recordId)}>
                        {r ? `${r.date} ${r.craneName}` : a.recordId.slice(0, 12)}
                      </button>
                      <span className="muted">— {a.description}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!byType.size && <div className="muted">本批次未检出异常。</div>}
        </div>
      </section>
    </div>
  );
}
