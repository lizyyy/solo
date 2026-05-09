import React, { useState } from 'react';
import { api } from '../api';

export const ExportPanel: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('all');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');

  const handleExport = () => {
    const url = api.getExportUrl({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status: status === 'all' ? undefined : status,
      format,
    });
    window.location.href = url;
  };

  return (
    <div className="upload-section">
      <h3 className="section-title">📤 报告导出</h3>

      <div className="filters">
        <div className="filter-group">
          <label>开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>交易状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="unreviewed">待复核</option>
            <option value="reviewed">已复核</option>
            <option value="confirmed">确认异常</option>
            <option value="rejected">误判</option>
          </select>
        </div>

        <div className="filter-group">
          <label>导出格式</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}>
            <option value="csv">CSV (Excel 可直接打开)</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={handleExport}>
          📥 导出报告
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 0 }}>
        导出的报告包含：交易ID、金额、商户、品类、国家、用户ID、交易时间、风险评分、异常标记、复核状态、复核结论、复核意见、复核人、复核时间、导入时间
      </div>
    </div>
  );
};
