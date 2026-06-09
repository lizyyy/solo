import { useState } from 'react';
import type { PersistedSummary, Snapshot } from '../types';

interface Props {
  autoSummary: string;
  persisted: PersistedSummary | undefined;
  onSave: (content: string) => void;
  snapshots: Snapshot[];
  onRestore: (id: string) => void;
}

export default function SummaryPanel({
  autoSummary,
  persisted,
  onSave,
  snapshots,
  onRestore,
}: Props) {
  const [editing, setEditing] = useState(!!persisted?.content);
  const [text, setText] = useState(persisted?.content || autoSummary);
  const [showHist, setShowHist] = useState(false);

  return (
    <section className="panel summary-panel">
      <div className="panel-head">
        <h3>页面摘要（重跑不丢）</h3>
        <div className="head-actions">
          <button
            className="btn ghost"
            onClick={() => {
              setText(autoSummary);
              onSave(autoSummary);
            }}
          >
            用自动生成覆盖
          </button>
          <button
            className="btn ghost"
            onClick={() => setShowHist((v) => !v)}
          >
            历史版本 {persisted?.history.length || 0}
          </button>
          {editing ? (
            <button
              className="btn primary"
              onClick={() => {
                onSave(text);
                setEditing(false);
              }}
            >
              保存
            </button>
          ) : (
            <button className="btn" onClick={() => setEditing(true)}>
              编辑
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          className="summary-editor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
        />
      ) : (
        <p className="summary-text">
          {persisted?.content || autoSummary}
          {persisted && (
            <span className="summary-meta muted">
              {'  ·  最后保存：' + new Date(persisted.updatedAt).toLocaleString('zh-CN')}
            </span>
          )}
        </p>
      )}

      {showHist && persisted?.history.length ? (
        <div className="hist-box">
          <h5>摘要历史</h5>
          <ol>
            {persisted.history.map((h, i) => (
              <li key={i}>
                <div className="hist-meta muted">
                  {new Date(h.updatedAt).toLocaleString('zh-CN')} · 运行于{' '}
                  {new Date(h.runAt).toLocaleString('zh-CN')}
                </div>
                <div className="hist-content">{h.content}</div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {snapshots.length > 0 && (
        <div className="snap-row">
          <h5>运行快照（可回溯）</h5>
          <div className="snap-list">
            {snapshots.slice(0, 8).map((s) => (
              <button key={s.id} className="snap-chip" onClick={() => onRestore(s.id)}>
                <span className="snap-time">
                  {new Date(s.runAt).toLocaleString('zh-CN', { hour12: false })}
                </span>
                <span className="snap-meta muted">
                  {s.recordCount} 条 / 异常 {s.anomalyCount}
                </span>
                {s.note && <span className="snap-note">📝 {s.note.slice(0, 12)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
