import { useState, useEffect } from 'react';
import { plansApi, locationsApi } from '../api';
import type { PlanVersion, Location } from '../api';

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanVersion[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanVersion | null>(null);
  const [planReports, setPlanReports] = useState<any[]>([]);

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
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlanDetail(plan: PlanVersion) {
    setSelectedPlan(plan);
    try {
      const res = await plansApi.getById(plan.id);
      setPlanReports(res.data.reports);
    } catch (error) {
      console.error('加载方案详情失败:', error);
    }
  }

  const getLocationName = (locationId: number) => {
    return locations.find(l => l.id === locationId)?.name || '未知点位';
  };

  async function handleGenerateReport(planId: number) {
    try {
      await plansApi.generateReport(planId, '何工');
      if (selectedPlan?.id === planId) {
        loadPlanDetail(selectedPlan);
      }
      alert('报告生成成功！');
    } catch (error) {
      console.error('生成报告失败:', error);
      alert('生成报告失败');
    }
  }

  async function handleStatusChange(id: number, status: string) {
    try {
      await plansApi.update(id, { status: status as any });
      loadData();
      if (selectedPlan?.id === id) {
        setSelectedPlan({ ...selectedPlan, status: status as any });
      }
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>修剪方案</h2>
        <p>管理树木修剪方案版本，追踪执行进度</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPlan ? '1fr 400px' : '1fr', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3>方案列表 ({plans.length}条)</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              🔄 刷新
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>方案标题</th>
                  <th>点位</th>
                  <th>版本</th>
                  <th>修剪类型</th>
                  <th>创建人</th>
                  <th>计划日期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => (
                  <tr key={plan.id} style={{ background: selectedPlan?.id === plan.id ? 'var(--bg-secondary)' : '' }}>
                    <td style={{ fontWeight: '500' }}>{plan.title}</td>
                    <td>{getLocationName(plan.locationId)}</td>
                    <td>v{plan.version}</td>
                    <td>{plan.pruningType}</td>
                    <td>{plan.createdBy}</td>
                    <td>{plan.estimatedDate || '-'}</td>
                    <td>
                      <select 
                        className="form-input" 
                        style={{ width: '90px', padding: '4px 6px', fontSize: '12px' }}
                        value={plan.status}
                        onChange={(e) => handleStatusChange(plan.id, e.target.value)}
                      >
                        <option value="draft">草稿</option>
                        <option value="approved">已批准</option>
                        <option value="in_progress">进行中</option>
                        <option value="completed">已完成</option>
                        <option value="cancelled">已取消</option>
                      </select>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => loadPlanDetail(plan)}
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

        {selectedPlan && (
          <div className="card">
            <div className="card-header">
              <h3>方案详情</h3>
              <button className="close-btn" onClick={() => setSelectedPlan(null)}>&times;</button>
            </div>
            <div className="card-body">
              <div className="info-row">
                <div className="info-label">方案标题</div>
                <div className="info-value">{selectedPlan.title}</div>
              </div>
              <div className="info-row">
                <div className="info-label">版本</div>
                <div className="info-value">v{selectedPlan.version}</div>
              </div>
              <div className="info-row">
                <div className="info-label">点位</div>
                <div className="info-value">{getLocationName(selectedPlan.locationId)}</div>
              </div>
              <div className="info-row">
                <div className="info-label">修剪类型</div>
                <div className="info-value">{selectedPlan.pruningType}</div>
              </div>
              <div className="info-row">
                <div className="info-label">计划日期</div>
                <div className="info-value">{selectedPlan.estimatedDate || '-'}</div>
              </div>
              <div className="info-row">
                <div className="info-label">施工单位</div>
                <div className="info-value">{selectedPlan.contractor || '-'}</div>
              </div>
              <div className="info-row">
                <div className="info-label">预计费用</div>
                <div className="info-value">{selectedPlan.cost ? `¥${selectedPlan.cost}` : '-'}</div>
              </div>
              <div className="info-row">
                <div className="info-label">状态</div>
                <div className="info-value">
                  <span className={`badge badge-${selectedPlan.status}`}>
                    {selectedPlan.status === 'draft' ? '草稿' :
                     selectedPlan.status === 'approved' ? '已批准' :
                     selectedPlan.status === 'in_progress' ? '进行中' :
                     selectedPlan.status === 'completed' ? '已完成' : '已取消'}
                  </span>
                </div>
              </div>
              
              {selectedPlan.description && (
                <>
                  <div className="section-title">方案说明</div>
                  <p style={{ fontSize: '14px', lineHeight: '1.8' }}>{selectedPlan.description}</p>
                </>
              )}

              <div className="section-title">关联报告 ({planReports.length})</div>
              {planReports.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>暂无报告</p>
              ) : (
                planReports.map(report => (
                  <div key={report.id} style={{
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{report.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {report.reportNo} · {report.generatedAt}
                    </div>
                  </div>
                ))
              )}

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '16px' }}
                onClick={() => handleGenerateReport(selectedPlan.id)}
              >
                📄 生成修剪报告
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
