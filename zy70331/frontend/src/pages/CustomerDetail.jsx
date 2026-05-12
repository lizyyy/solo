import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [rateInfo, setRateInfo] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [billing, setBilling] = useState(null);
  const [excess, setExcess] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastUsageResult, setLastUsageResult] = useState(null);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState('');
  const [boostAmount, setBoostAmount] = useState('');
  const [boostDuration, setBoostDuration] = useState('');
  const [subscribeType, setSubscribeType] = useState('paid');
  const [subscribePlan, setSubscribePlan] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [c, r, t, b, e, p] = await Promise.all([
        api.getCustomer(id),
        api.checkRate(id),
        api.getTimeline(id),
        api.getBilling(id),
        api.getExcess(id),
        api.getPlans()
      ]);
      setCustomer(c);
      setRateInfo(r);
      setTimeline(t);
      setBilling(b);
      setExcess(e);
      setPlans(p);
      setLoading(false);
    } catch (err) {
      setError('加载数据失败: ' + err.message);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showSuccess(msg) {
    setMessage(msg);
    setError('');
    setTimeout(() => setMessage(''), 5000);
  }

  function showError(msg) {
    setError(msg);
    setMessage('');
    setTimeout(() => setError(''), 5000);
  }

  async function handleUpgrade() {
    if (!selectedPlan) {
      showError('请选择目标套餐');
      return;
    }
    try {
      await api.upgrade(id, selectedPlan);
      setShowUpgrade(false);
      setSelectedPlan('');
      showSuccess('升级成功！立即生效');
      loadData();
    } catch (err) {
      showError('升级失败: ' + err.message);
    }
  }

  async function handleDowngrade() {
    if (!selectedPlan) {
      showError('请选择目标套餐');
      return;
    }
    try {
      await api.downgrade(id, selectedPlan);
      setShowDowngrade(false);
      setSelectedPlan('');
      showSuccess('已创建降级请求，将于下周期生效');
      loadData();
    } catch (err) {
      showError('降级失败: ' + err.message);
    }
  }

  async function handleBoost() {
    if (!boostAmount || !boostDuration) {
      showError('请填写加量额度和时长');
      return;
    }
    try {
      await api.boost(id, boostAmount, boostDuration);
      setShowBoost(false);
      setBoostAmount('');
      setBoostDuration('');
      showSuccess('临时加量成功！立即生效');
      loadData();
    } catch (err) {
      showError('加量失败: ' + err.message);
    }
  }

  async function handleSubscribe() {
    if (!subscribePlan) {
      showError('请选择套餐');
      return;
    }
    try {
      await api.subscribe(id, {
        planId: subscribePlan,
        type: subscribeType
      });
      setShowSubscribe(false);
      setSubscribePlan('');
      showSuccess('订阅成功');
      loadData();
    } catch (err) {
      showError('订阅失败: ' + err.message);
    }
  }

  async function recordUsage(priority) {
    try {
      const result = await api.recordUsage(id, {
        apiEndpoint: '/api/v1/test',
        priority,
        operator: 'admin'
      });
      setLastUsageResult(result);
      showSuccess(
        result.allowed 
          ? `请求成功！剩余额度: ${result.rateInfo.remaining}` 
          : `请求被拒绝！原因: ${result.reason}`
      );
      loadData();
    } catch (err) {
      showError('记录用量失败: ' + err.message);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!customer) {
    return <div className="alert alert-danger">客户不存在</div>;
  }

  const usagePercent = rateInfo.rateLimit > 0 
    ? (rateInfo.currentUsage / rateInfo.rateLimit) * 100 
    : 0;
  const progressClass = usagePercent < 50 ? 'low' : usagePercent < 80 ? 'medium' : 'high';

  const availablePlans = plans.filter(p => {
    if (!rateInfo.currentSubscription) return p.is_trial !== 1;
    return p.id !== rateInfo.currentSubscription.id;
  });

  const downgradePlans = availablePlans.filter(p => {
    if (!rateInfo.currentSubscription) return true;
    const currentPlan = plans.find(pl => pl.name === rateInfo.currentSubscription.planName);
    return currentPlan ? p.rate_limit < currentPlan.rate_limit : true;
  });

  const upgradePlans = availablePlans.filter(p => {
    if (!rateInfo.currentSubscription) return true;
    const currentPlan = plans.find(pl => pl.name === rateInfo.currentSubscription.planName);
    return currentPlan ? p.rate_limit > currentPlan.rate_limit : true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link to="/customers" className="muted text-sm mb-2 block">← 返回客户列表</Link>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{customer.name}</h2>
          <p className="muted">{customer.email || '未设置邮箱'}</p>
        </div>
        <div className="flex gap-2">
          {rateInfo.hasActiveSubscription ? (
            <>
              <button className="btn btn-success" onClick={() => setShowUpgrade(true)}>
                升级套餐
              </button>
              <button className="btn btn-warning" onClick={() => setShowDowngrade(true)}>
                降级套餐
              </button>
              <button className="btn btn-primary" onClick={() => setShowBoost(true)}>
                临时加量
              </button>
            </>
          ) : (
            <button className="btn btn-success" onClick={() => setShowSubscribe(true)}>
              创建订阅
            </button>
          )}
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="grid grid-3 mb-4">
        <div className="stat-card">
          <div className="text-sm muted mb-1">当前套餐</div>
          <div className="font-semibold" style={{ fontSize: '1.125rem' }}>
            {rateInfo.hasActiveSubscription 
              ? rateInfo.currentSubscription.planName 
              : '无活跃订阅'}
          </div>
          {rateInfo.currentSubscription?.isTrial && (
            <span className="badge badge-info mt-2">试用</span>
          )}
          {rateInfo.currentSubscription && (
            <div className="text-xs muted mt-2">
              {new Date(rateInfo.currentSubscription.startDate).toLocaleDateString()}
              {rateInfo.currentSubscription.endDate && (
                <span> ~ {new Date(rateInfo.currentSubscription.endDate).toLocaleDateString()}</span>
              )}
            </div>
          )}
          {rateInfo.pendingDowngrade && (
            <div className="alert alert-warning mt-2" style={{ margin: 0, padding: '0.5rem', fontSize: '0.75rem' }}>
              ⏳ 待生效降级: {rateInfo.pendingDowngrade.planName}
              <br />
              生效时间: {new Date(rateInfo.pendingDowngrade.effectiveAt).toLocaleString()}
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="text-sm muted mb-1">当前用量</div>
          <div className="font-semibold" style={{ fontSize: '1.125rem' }}>
            {rateInfo.currentUsage} / {rateInfo.rateLimit}
            <span className="text-sm muted ml-2">次/{rateInfo.rateWindow}</span>
          </div>
          <div className="progress-bar">
            <div 
              className={`progress-fill ${progressClass}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <div className="text-xs muted mt-2">
            剩余: {rateInfo.remaining} 次
            {rateInfo.isExceeded && (
              <span className="badge badge-danger ml-2">已超额</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="text-sm muted mb-1">账单预估（近30天）</div>
          <div className="font-semibold" style={{ fontSize: '1.5rem' }}>
            ¥{billing.totalCost}
          </div>
          <div className="text-xs muted mt-2">
            套餐费用: ¥{billing.subscriptionCost}
            {billing.excessCost > 0 && (
              <span className="badge badge-danger ml-2">超额: +¥{billing.excessCost}</span>
            )}
          </div>
          <div className="text-xs muted">
            总请求: {billing.usage.totalRequests} 次
          </div>
        </div>
      </div>

      {rateInfo.excessReason && (
        <div className="alert alert-danger mb-4">
          <strong>超额原因:</strong> {rateInfo.excessReason}
          {rateInfo.excessReason === 'TRIAL_EXPIRING_SOON' && (
            <span> - 试用即将过期，请及时续费或升级</span>
          )}
          {rateInfo.excessReason === 'RATE_LIMIT_EXCEEDED' && (
            <span> - 已达到当前速率限制，高优先级接口将被拒绝</span>
          )}
          {rateInfo.excessReason === 'NO_ACTIVE_SUBSCRIPTION' && (
            <span> - 没有活跃订阅，请先创建订阅</span>
          )}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <h2>实时用量测试</h2>
            <div className="flex gap-2">
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => recordUsage(1)}
              >
                模拟高优先级请求
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => recordUsage(2)}
              >
                模拟低优先级请求
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {lastUsageResult ? (
            <div className={lastUsageResult.allowed ? 'alert alert-success' : 'alert alert-danger'}>
              <strong>{lastUsageResult.allowed ? '✅ 请求允许' : '❌ 请求拒绝'}</strong>
              {lastUsageResult.reason && (
                <div className="text-sm mt-1">原因: {lastUsageResult.reason}</div>
              )}
              <div className="text-sm mt-1">
                当前窗口: {new Date(lastUsageResult.rateInfo.window.start).toLocaleTimeString()} 
                - {new Date(lastUsageResult.rateInfo.window.end).toLocaleTimeString()}
              </div>
              <div className="text-sm">
                用量: {lastUsageResult.rateInfo.currentUsage}/{lastUsageResult.rateInfo.rateLimit}
                | 剩余: {lastUsageResult.rateInfo.remaining}
              </div>
            </div>
          ) : (
            <p className="muted">点击按钮模拟 API 请求，查看实时速率限制判断结果。</p>
          )}
          <div className="alert alert-info mt-4">
            <strong>规则说明:</strong>
            <ul className="mt-2 text-sm" style={{ marginLeft: '1.5rem' }}>
              <li>高优先级接口（priority=1）：超额后直接拒绝</li>
              <li>低优先级接口（priority>1）：超额后允许但降速并记录超额费用</li>
              <li>升级立即生效，降级下周期生效</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-2 gap-4">
        <div className="card">
          <div className="card-header">
            <h2>套餐时间线</h2>
          </div>
          <div className="card-body">
            {timeline.length === 0 ? (
              <p className="muted">暂无订阅记录</p>
            ) : (
              <div className="timeline">
                {timeline.map((item) => {
                  let dotClass = 'past';
                  let typeLabel = '订阅';
                  if (item.timelineStatus === 'active') dotClass = 'active';
                  else if (item.timelineStatus === 'pending') dotClass = 'pending';
                  else if (item.isTrial) dotClass = 'trial';
                  else if (item.isBoost) dotClass = 'boost';

                  if (item.isTrial) typeLabel = '试用';
                  else if (item.isBoost) typeLabel = '临时加量';
                  else if (item.isUpgrade) typeLabel = '升级';
                  else if (item.isDowngrade) typeLabel = '降级';

                  return (
                    <div key={item.id} className="timeline-item">
                      <div className={`timeline-dot ${dotClass}`} />
                      <div className="timeline-content">
                        <div className="flex justify-between items-start">
                          <h4>
                            <span className={`badge ${dotClass === 'pending' ? 'badge-warning' : dotClass === 'active' ? 'badge-primary' : dotClass === 'trial' ? 'badge-success' : dotClass === 'boost' ? 'badge-info' : 'badge-secondary'}`}>
                              {typeLabel}
                            </span>
                            {item.planName}
                          </h4>
                          {item.timelineStatus === 'active' && (
                            <span className="badge badge-success">当前</span>
                          )}
                        </div>
                        <p className="mt-1">
                          {item.rateLimit} 次/{item.rateWindow}
                        </p>
                        <p>
                          {new Date(item.startDate).toLocaleString()}
                          {item.endDate && (
                            <span> ~ {new Date(item.endDate).toLocaleString()}</span>
                          )}
                        </p>
                        <p className="text-xs muted">
                          状态: {item.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card mb-4">
            <div className="card-header">
              <h2>账单明细</h2>
            </div>
            <div className="card-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>套餐</th>
                    <th>类型</th>
                    <th>天数</th>
                    <th>费用</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.breakdown.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="muted text-center">暂无费用明细</td>
                    </tr>
                  ) : (
                    billing.breakdown.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.planName}</td>
                        <td>
                          <span className="badge badge-info">
                            {item.type === 'trial' ? '试用' : 
                             item.type === 'temp_boost' ? '加量' :
                             item.type === 'upgrade' ? '升级' :
                             item.type === 'downgrade' ? '降级' : '付费'}
                          </span>
                        </td>
                        <td>{item.days}天</td>
                        <td>¥{item.cost.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                  {billing.excessCost > 0 && (
                    <tr>
                      <td colSpan="3" className="font-semibold">超额费用</td>
                      <td>¥{billing.excessCost}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan="3" className="font-semibold">总计</td>
                    <td className="font-semibold">¥{billing.totalCost}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>超额记录</h2>
            </div>
            <div className="card-body">
              {excess.length === 0 ? (
                <p className="muted">暂无超额记录</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>时间窗口</th>
                      <th>套餐</th>
                      <th>超限</th>
                      <th>费用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excess.slice(0, 10).map(record => (
                      <tr key={record.id}>
                        <td className="text-xs">
                          {new Date(record.window_start).toLocaleString()}
                        </td>
                        <td>{record.plan_name || '-'}</td>
                        <td>
                          <span className="badge badge-danger">
                            +{record.excess_count}
                          </span>
                        </td>
                        <td>¥{record.billing_impact.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {showUpgrade && (
        <div className="modal-backdrop" onClick={() => setShowUpgrade(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>升级套餐</h3>
              <button className="close-btn" onClick={() => setShowUpgrade(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                <strong>升级立即生效</strong> - 当前套餐将被立即替换
              </div>
              <div className="form-group">
                <label>选择目标套餐</label>
                <select 
                  className="form-select"
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value)}
                >
                  <option value="">请选择</option>
                  {upgradePlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {plan.rate_limit}次/{plan.rate_window} - ¥{plan.monthly_price}/月
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUpgrade(false)}>取消</button>
              <button className="btn btn-success" onClick={handleUpgrade}>确认升级</button>
            </div>
          </div>
        </div>
      )}

      {showDowngrade && (
        <div className="modal-backdrop" onClick={() => setShowDowngrade(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>降级套餐</h3>
              <button className="close-btn" onClick={() => setShowDowngrade(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <strong>降级下周期生效</strong> - 当前套餐将持续到下一计费周期
              </div>
              <div className="form-group">
                <label>选择目标套餐</label>
                <select 
                  className="form-select"
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value)}
                >
                  <option value="">请选择</option>
                  {downgradePlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {plan.rate_limit}次/{plan.rate_window} - ¥{plan.monthly_price}/月
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDowngrade(false)}>取消</button>
              <button className="btn btn-warning" onClick={handleDowngrade}>确认降级</button>
            </div>
          </div>
        </div>
      )}

      {showBoost && (
        <div className="modal-backdrop" onClick={() => setShowBoost(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>临时加量</h3>
              <button className="close-btn" onClick={() => setShowBoost(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                <strong>立即生效</strong> - 临时加量套餐将立即生效，到期后自动恢复原套餐
              </div>
              <div className="form-group">
                <label>加量额度（次/分钟）</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="例如：100"
                  value={boostAmount}
                  onChange={e => setBoostAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>持续时间（小时）</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="例如：24"
                  value={boostDuration}
                  onChange={e => setBoostDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBoost(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleBoost}>确认加量</button>
            </div>
          </div>
        </div>
      )}

      {showSubscribe && (
        <div className="modal-backdrop" onClick={() => setShowSubscribe(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>创建订阅</h3>
              <button className="close-btn" onClick={() => setShowSubscribe(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>订阅类型</label>
                <select 
                  className="form-select"
                  value={subscribeType}
                  onChange={e => setSubscribeType(e.target.value)}
                >
                  <option value="paid">付费订阅</option>
                  <option value="trial">试用订阅</option>
                </select>
              </div>
              <div className="form-group">
                <label>选择套餐</label>
                <select 
                  className="form-select"
                  value={subscribePlan}
                  onChange={e => setSubscribePlan(e.target.value)}
                >
                  <option value="">请选择</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {plan.rate_limit}次/{plan.rate_window}
                      {plan.is_trial === 1 && ' (试用)'}
                      {plan.monthly_price > 0 && ` - ¥${plan.monthly_price}/月`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSubscribe(false)}>取消</button>
              <button className="btn btn-success" onClick={handleSubscribe}>创建订阅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetail;
