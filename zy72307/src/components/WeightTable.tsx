import React, { useState } from 'react';
import { WeightRow, WarningType } from '../types';

interface WeightTableProps {
  rows: WeightRow[];
  onRowUpdate: (id: string, newValue: string) => void;
  onNoteUpdate: (id: string, note: string) => void;
}

const warningLabels: Record<WarningType, string> = {
  percent_decimal_mixed: '百分数小数混合',
  duplicate_row: '重复行',
  invalid_value: '无效值',
  high_condition_number: '高条件数'
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: '#9e9e9e' },
  normal: { label: '正常', color: '#4caf50' },
  warning: { label: '警告', color: '#ff9800' },
  error: { label: '错误', color: '#f44336' },
  needs_review: { label: '待复核', color: '#2196f3' }
};

export const WeightTable: React.FC<WeightTableProps> = ({ rows, onRowUpdate, onNoteUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (row: WeightRow) => {
    setEditingId(row.id);
    setEditValue(row.originalValue);
  };

  const handleSave = (id: string) => {
    onRowUpdate(id, editValue);
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="table-container">
      <table className="weight-table">
        <thead>
          <tr>
            <th>原始行号</th>
            <th>指标名称</th>
            <th>原始值</th>
            <th>计算值</th>
            <th>格式</th>
            <th>状态</th>
            <th>警告</th>
            <th>人工修改</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className={row.isManualModified ? 'modified' : ''}>
              <td className="row-number">{row.originalRowNumber}</td>
              <td className="criterion-name">{row.criterionName}</td>
              <td className="original-value">
                {editingId === row.id ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="edit-input"
                  />
                ) : (
                  <span>{row.originalValue}</span>
                )}
              </td>
              <td className="current-value">{row.currentValue.toFixed(4)}</td>
              <td className="format-type">
                {row.isPercent ? (
                  <span className="badge percent">百分比</span>
                ) : (
                  <span className="badge decimal">小数</span>
                )}
              </td>
              <td className="status">
                <span 
                  className="status-badge"
                  style={{ backgroundColor: statusLabels[row.status]?.color || '#9e9e9e' }}
                >
                  {statusLabels[row.status]?.label || row.status}
                </span>
              </td>
              <td className="warnings">
                {row.warnings.length > 0 ? (
                  <div className="warning-list">
                    {row.warnings.map((w, i) => (
                      <span key={i} className="warning-tag">
                        {warningLabels[w]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="no-warning">-</span>
                )}
              </td>
              <td className="modified">
                {row.isManualModified ? (
                  <span className="modified-badge">是</span>
                ) : (
                  <span className="no-modified">否</span>
                )}
              </td>
              <td className="notes">
                <input
                  type="text"
                  placeholder="添加备注..."
                  value={row.notes || ''}
                  onChange={(e) => onNoteUpdate(row.id, e.target.value)}
                  className="note-input"
                />
              </td>
              <td className="actions">
                {editingId === row.id ? (
                  <>
                    <button className="btn-save" onClick={() => handleSave(row.id)}>保存</button>
                    <button className="btn-cancel" onClick={handleCancel}>取消</button>
                  </>
                ) : (
                  <button className="btn-edit" onClick={() => handleEdit(row)}>编辑</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
