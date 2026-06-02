import { useState, useEffect } from 'react';
import { reportsApi, plansApi, locationsApi } from '../api';
import type { Report, PlanVersion, Location } from '../api';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [plans, setPlans] = useState<PlanVersion[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [plansRes, locationsRes] = await Promise.all([
        plansApi.getAll(),
        locationsApi.getAll()
      ]);
      setPlans(plansRes.data);
      setLocations(locationsRes.data);
      
      const allReports: Report[] = [];
      for (const plan of plansRes.data) {
        try {
          const res = await plansApi.getById(plan.id);
          allReports.push(...res.data.reports);
        } catch (e) {
          // ignore
        }
      }
      setReports(allReports.sort((a, b) => 
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      ));
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const getPlanTitle = (planId: number) => {
    return plans.find(p => p.id === planId)?.title || '未知方案';
  };

  const getLocationName = (locationId: number) => {
    return locations.find(l => l.id === locationId)?.name || '未知点位';
  };

  function viewReport(report: Report) {
    setSelectedReport(report);
    setEditingReport(null);
  }

  function startEdit(report: Report) {
    setEditingReport(report);
    setSelectedReport(null);
    setEditContent(report.content);
  }

  async function saveEdit() {
    if (!editingReport) return;
    
    try {
      await reportsApi.update(editingReport.id, { content: editContent });
      setEditingReport(null);
      loadData();
      alert('保存成功！');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>报告管理</h2>
        <p>管理树木修剪执行报告，确保作业有据可查</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedReport || editingReport ? '1fr 500px' : '1fr', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3>报告列表 ({reports.length}份)</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              🔄 刷新
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>报告编号</th>
                  <th>报告标题</th>
                  <th>关联点位</th>
                  <th>关联方案</th>
                  <th>生成人</th>
                  <th>生成时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr 
                    key={report.id} 
                    style={{ background: selectedReport?.id === report.id ? 'var(--bg-secondary)' : '' }}
                  >
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{report.reportNo}</td>
                    <td>{report.title}</td>
                    <td>{getLocationName(report.locationId)}</td>
                    <td>{getPlanTitle(report.planVersionId)}</td>
                    <td>{report.generatedBy}</td>
                    <td>{report.generatedAt}</td>
                    <td>
                      <span className={`badge badge-${report.status}`}>
                        {report.status === 'draft' ? '草稿' :
                         report.status === 'submitted' ? '已提交' :
                         report.status === 'approved' ? '已批准' : '已归档'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => viewReport(report)}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedReport && (
          <div className="card">
            <div className="card-header">
              <h3>报告详情</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(selectedReport)}>
                  ✏️ 编辑
                </button>
                <button className="close-btn" onClick={() => setSelectedReport(null)}>&times;</button>
              </div>
            </div>
            <div className="card-body">
              <div className="info-row">
                <div className="info-label">报告编号</div>
                <div className="info-value" style={{ fontFamily: 'monospace' }}>{selectedReport.reportNo}</div>
              </div>
              <div className="info-row">
                <div className="info-label">报告标题</div>
                <div className="info-value">{selectedReport.title}</div>
              </div>
              <div className="info-row">
                <div className="info-label">关联点位</div>
                <div className="info-value">{getLocationName(selectedReport.locationId)}</div>
              </div>
              <div className="info-row">
                <div className="info-label">关联方案</div>
                <div className="info-value">{getPlanTitle(selectedReport.planVersionId)}</div>
              </div>
              <div className="info-row">
                <div className="info-label">生成人</div>
                <div className="info-value">{selectedReport.generatedBy}</div>
              </div>
              <div className="info-row">
                <div className="info-label">生成时间</div>
                <div className="info-value">{selectedReport.generatedAt}</div>
              </div>
              <div className="info-row">
                <div className="info-label">状态</div>
                <div className="info-value">
                  <span className={`badge badge-${selectedReport.status}`}>
                    {selectedReport.status === 'draft' ? '草稿' :
                     selectedReport.status === 'submitted' ? '已提交' :
                     selectedReport.status === 'approved' ? '已批准' : '已归档'}
                  </span>
                </div>
              </div>

              <div className="section-title">报告内容</div>
              <div className="report-content">
                {selectedReport.content.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={i}>{line.replace('# ', '')}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={i}>{line.replace('## ', '')}</h2>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={i}>{line.replace('- ', '')}</li>;
                  }
                  return <div key={i}>{line || <br />}</div>;
                })}
              </div>
            </div>
          </div>
        )}

        {editingReport && (
          <div className="card">
            <div className="card-header">
              <h3>编辑报告</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={saveEdit}>
                  💾 保存
                </button>
                <button className="close-btn" onClick={() => setEditingReport(null)}>&times;</button>
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">报告内容（支持Markdown格式）</label>
                <textarea
                  className="form-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ minHeight: '400px', fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                提示：使用 # 标题、## 副标题、- 列表 等Markdown格式
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>📋 报告生成逻辑说明</h3>
        </div>
        <div className="card-body">
          <div style={{ fontSize: '14px', lineHeight: '2' }}>
            <p>报告自动从修剪方案生成，包含以下内容：</p>
            <ul style={{ paddingLeft: '24px' }}>
              <li><strong>基本信息</strong>：方案版本、修剪类型、计划日期、施工单位、预计费用</li>
              <li><strong>居民反馈汇总</strong>：自动汇总该点位的所有居民反馈，保留原始信息</li>
              <li><strong>修剪作业建议</strong>：根据反馈内容智能生成可执行的操作建议</li>
              <li><strong>现场情况</strong>：待现场勘查后填写实际情况</li>
              <li><strong>修剪后效果</strong>：作业完成后记录效果</li>
              <li><strong>存在问题及后续措施</strong>：记录发现的问题及跟进计划</li>
            </ul>
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
              💡 报告内容可人工编辑修改，确保报告与实际情况一致。报告与方案、点位互相关联，便于追溯。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
