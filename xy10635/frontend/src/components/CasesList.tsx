import React, { useState } from 'react';
import { Case, getStatusLabel, getStatusColor, getPriorityLabel, getPriorityColor, getDomainLabel, CASE_STATUSES, CASE_DOMAINS } from '../types';

interface CasesListProps {
  cases: Case[];
  loading: boolean;
  onViewCase: (caseItem: Case) => void;
  onCreateCase: () => void;
  onExport: () => void;
}

const CasesList: React.FC<CasesListProps> = ({ cases, loading, onViewCase, onCreateCase, onExport }) => {
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  const filteredCases = cases.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (domainFilter && c.case_domain !== domainFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="section">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="flex justify-between items-center mb-5">
        <h2 className="section-title" style={{ margin: 0, padding: 0, border: 'none' }}>
          案件列表
        </h2>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={onExport}>
            导出报告
          </button>
          <button className="btn btn-primary" onClick={onCreateCase}>
            新建案件
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-item">
          <label>状态</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部</option>
            {CASE_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>领域</label>
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
            <option value="">全部</option>
            {CASE_DOMAINS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">暂无案件数据</div>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>案件编号</th>
              <th>标题</th>
              <th>对方主体</th>
              <th>领域</th>
              <th>优先级</th>
              <th>状态</th>
              <th>指派律师</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.case_number}</td>
                <td>{c.title}</td>
                <td>{c.opposing_party}</td>
                <td>
                  <span className="badge badge-primary">{getDomainLabel(c.case_domain)}</span>
                </td>
                <td>
                  <span className="badge" style={{ background: getPriorityColor(c.priority) + '20', color: getPriorityColor(c.priority) }}>
                    {getPriorityLabel(c.priority)}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ background: getStatusColor(c.status) + '20', color: getStatusColor(c.status) }}>
                    {getStatusLabel(c.status)}
                  </span>
                </td>
                <td>{c.assigned_lawyer_name || '-'}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => onViewCase(c)}>
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CasesList;
