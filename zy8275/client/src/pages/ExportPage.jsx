import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function ExportPage() {
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const buildExportUrl = (format) => {
    const params = new URLSearchParams();
    if (filters.start_date) {
      params.append('start_date', filters.start_date);
    }
    if (filters.end_date) {
      params.append('end_date', filters.end_date);
    }
    const queryString = params.toString();
    return `/api/export/${format}${queryString ? `?${queryString}` : ''}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" className="btn btn-secondary btn-sm">← 返回看板</Link>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">审批流水数据导出</h2>
        </div>

        <div className="form-group">
          <label className="form-label">筛选条件（可选）</label>
          <div className="detail-grid" style={{ marginTop: '10px' }}>
            <div className="form-group">
              <label className="form-label">开始日期</label>
              <input
                type="date"
                className="form-control"
                name="start_date"
                value={filters.start_date}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">结束日期</label>
              <input
                type="date"
                className="form-control"
                name="end_date"
                value={filters.end_date}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="export-section">
          <a 
            href={buildExportUrl('csv')} 
            className="btn btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>📊</span>
            导出 CSV
          </a>
          <a 
            href={buildExportUrl('markdown')} 
            className="btn btn-success"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>📝</span>
            导出 Markdown
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">导出内容说明</h3>
        </div>
        <div style={{ lineHeight: '1.8', color: '#555' }}>
          <h4 style={{ marginTop: '0', color: '#333' }}>CSV 格式</h4>
          <p>导出的 CSV 文件包含以下字段：</p>
          <ul style={{ marginLeft: '20px', marginBottom: '20px' }}>
            <li>申请ID、申请标题</li>
            <li>店铺名称、楼层、铺位号</li>
            <li>当前状态、施工类型</li>
            <li>计划开始时间、计划结束时间</li>
            <li>申请人</li>
            <li>操作类型、操作前状态、操作后状态</li>
            <li>操作备注、操作时间、操作人、操作人角色</li>
          </ul>

          <h4 style={{ color: '#333' }}>Markdown 格式</h4>
          <p>导出的 Markdown 文件包含：</p>
          <ul style={{ marginLeft: '20px' }}>
            <li>每个申请的详细信息卡片</li>
            <li>完整的审批流程时间线表格</li>
            <li>状态变更历史记录</li>
            <li>操作人及角色信息</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">状态机说明</h3>
        </div>
        <div style={{ lineHeight: '1.8', color: '#555' }}>
          <h4 style={{ marginTop: '0', color: '#333' }}>审批流程</h4>
          <ol style={{ marginLeft: '20px', marginBottom: '20px' }}>
            <li><strong>店长提交申请</strong> → 状态：已提交</li>
            <li><strong>工程主管审核</strong>
              <ul style={{ marginLeft: '20px' }}>
                <li>审核通过 → 状态：工程审核通过</li>
                <li>审核拒绝 → 状态：工程审核拒绝（终止）</li>
              </ul>
            </li>
            <li><strong>安保审核</strong>
              <ul style={{ marginLeft: '20px' }}>
                <li>同意放行 → 状态：安保已放行</li>
                <li>拒绝放行 → 状态：安保拒绝（终止）</li>
              </ul>
            </li>
            <li><strong>登记进场</strong> → 状态：施工中</li>
            <li><strong>施工期间</strong>
              <ul style={{ marginLeft: '20px' }}>
                <li>可暂停整改 → 状态：暂停整改</li>
                <li>整改后复工 → 状态：施工中</li>
              </ul>
            </li>
            <li><strong>完成施工</strong> → 状态：已完成</li>
            <li><strong>归档</strong> → 状态：已归档（终止）</li>
          </ol>

          <h4 style={{ color: '#333' }}>安全规则</h4>
          <ul style={{ marginLeft: '20px' }}>
            <li><strong>角色权限限制</strong>：每个角色只能执行指定的操作</li>
            <li><strong>时间检查</strong>：过期的通行证无法继续进场</li>
            <li><strong>整改确认</strong>：暂停后必须由工程主管确认复工</li>
            <li><strong>越级审批阻止</strong>：必须按流程顺序审批</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ExportPage;
