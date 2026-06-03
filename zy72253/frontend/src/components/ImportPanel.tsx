import React, { useState, useCallback } from 'react';
import { importRecords, ImportResult } from '../utils/api';

interface Props {
  onImported: () => void;
}

export default function ImportPanel({ onImported }: Props) {
  const [batchId, setBatchId] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleImport = useCallback(async () => {
    if (!batchId.trim() || !rawInput.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const lines = rawInput.trim().split('\n').filter(Boolean);
      const records = lines.map((line) => ({ raw_data: line }));
      const res = await importRecords(batchId.trim(), records);
      setResult(res);
      onImported();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [batchId, rawInput, onImported]);

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginBottom: 12, fontSize: 16, color: '#1a1a2e' }}>📥 导入测距仪记录</h3>

      <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#555' }}>批次号</label>
      <input
        value={batchId}
        onChange={(e) => setBatchId(e.target.value)}
        placeholder="例: BATCH-2026-0603"
        style={inputStyle}
      />

      <label style={{ display: 'block', marginTop: 10, marginBottom: 4, fontSize: 13, color: '#555' }}>
        测距仪原始记录（每行一条）
      </label>
      <textarea
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder={"30.2591, 121.9634, 12.5m\nX:1500 Y:3200 Z:5800 D:3.2m\n31.2304/121.4737 障碍物:集装箱倾斜"}
        rows={6}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
      />

      <button
        onClick={handleImport}
        disabled={loading || !batchId.trim() || !rawInput.trim()}
        style={buttonStyle(loading)}
      >
        {loading ? '导入中...' : '导入'}
      </button>

      {result && (
        <div style={{ marginTop: 12, padding: 12, background: '#f0f9ff', borderRadius: 6, fontSize: 13 }}>
          <div>✅ 新导入 <strong>{result.imported}</strong> 条</div>
          <div>⏭️ 重复跳过 <strong>{result.skipped_duplicates}</strong> 条</div>
          {result.mixed_coord_count > 0 && (
            <div style={{ color: '#d97706' }}>
              ⚠️ 坐标混用 <strong>{result.mixed_coord_count}</strong> 条，已标记待巡检组复核
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
};

function buttonStyle(loading: boolean): React.CSSProperties {
  return {
    marginTop: 12,
    padding: '8px 24px',
    background: loading ? '#93c5fd' : '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    cursor: loading ? 'not-allowed' : 'pointer',
  };
}
