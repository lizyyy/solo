import React, { useState, useEffect, useCallback } from 'react';
import { listRecords, RecordListItem } from '../utils/api';

interface Props {
  onSelectRecord: (id: string) => void;
  refreshKey: number;
}

const COORD_LABEL: Record<string, string> = {
  latlng: '经纬度',
  metric: '米制',
  mixed: '⚠️ 混用',
  latlng_with_distance: '经纬度+测距',
};

const STAGE_ORDER = ['imported', 'engineer_reviewed', 'crew_briefed'];

export default function RecordList({ onSelectRecord, refreshKey }: Props) {
  const [records, setRecords] = useState<RecordListItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'mixed' | 'needs_review'>('all');
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: { coord_type?: string; needs_review?: boolean } = {};
      if (filter === 'mixed') params.coord_type = 'mixed';
      if (filter === 'needs_review') params.needs_review = true;
      const data = await listRecords(params);
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, refreshKey]);

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, color: '#1a1a2e' }}>📋 测距仪记录列表</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13 }}
        >
          <option value="all">全部</option>
          <option value="mixed">仅坐标混用</option>
          <option value="needs_review">仅待复核</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>加载中...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>暂无记录，请先导入</div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>批次</th>
                <th style={{ padding: 8 }}>坐标类型</th>
                <th style={{ padding: 8 }}>待复核</th>
                <th style={{ padding: 8 }}>录入时间</th>
                <th style={{ padding: 8 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>{r.batch_id}</td>
                  <td style={{ padding: 8 }}>{COORD_LABEL[r.coord_type] || r.coord_type}</td>
                  <td style={{ padding: 8 }}>{r.needs_review ? '🔴 是' : '否'}</td>
                  <td style={{ padding: 8, fontSize: 12, color: '#666' }}>{r.imported_at?.slice(0, 19)}</td>
                  <td style={{ padding: 8 }}>
                    <button
                      onClick={() => onSelectRecord(r.id)}
                      style={{ padding: '2px 10px', border: '1px solid #3b82f6', borderRadius: 4, color: '#3b82f6', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
