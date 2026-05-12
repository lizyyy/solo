import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';
import { drillApi } from '../api';
import TopologyCanvas from '../components/TopologyCanvas';
import Timeline from '../components/Timeline';
import type { DrillResult, DrillResultItem } from '../types';

const TABS = [
  { id: 'overview', label: '总览' },
  { id: 'baseline', label: '基线测试' },
  { id: 'degraded', label: '故障注入测试' },
  { id: 'comparison', label: '对比分析' },
  { id: 'recovery', label: '恢复复测' },
];

export default function ResultsPage() {
  const results = useAppStore((s) => s.drillResults);
  const selectedId = useAppStore((s) => s.selectedResultId);
  const setSelectedResult = useAppStore((s) => s.setSelectedResult);
  const services = useAppStore((s) => s.services);
  const dependencies = useAppStore((s) => s.dependencies);
  const runRecovery = useAppStore((s) => s.runRecovery);

  const [tab, setTab] = useState('overview');
  const [loadingRecovery, setLoadingRecovery] = useState(false);

  const result = results.find((r) => r.id === selectedId);

  const handleRecovery = async () => {
    if (!result) return;
    setLoadingRecovery(true);
    try {
      await runRecovery(result.id);
    } finally {
      setLoadingRecovery(false);
    }
  };

  return (
    <div>
      <div className="grid grid-3">
        <div className="stat-card success">
          <div className="label">演练总数</div>
          <div className="value">{results.length}</div>
        </div>
        <div className="stat-card success">
          <div className="label">成功完成</div>
          <div className="value">
            {results.filter((r) => r.status === 'completed').length}
          </div>
        </div>
        <div className="stat-card warning">
          <div className="label">已做恢复复测</div>
          <div className="value">
            {results.filter((r) => r.recoveryResult).length}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h2>演练结果列表</h2>
        </div>

        {results.length === 0 ? (
          <div className="empty">暂无演练结果。请去【演练控制】页面执行演练。</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>演练名称</th>
                <th>开始时间</th>
                <th>状态</th>
                <th>用户影响</th>
                <th>恢复复测</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.id}
                  className={selectedId === r.id ? 'active' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedResult(r.id);
                    setTab('overview');
                  }}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.planName}</div>
                    <div className="muted">{r.id.substring(0, 8)}</div>
                  </td>
                  <td>{r.startedAt.split('T')[0]} {r.startedAt.split('T')[1].split('.')[0]}</td>
                  <td>
                    <span
                      className={
                        r.status === 'completed'
                          ? 'badge badge-success'
                          : r.status === 'running'
                          ? 'badge badge-running'
                          : 'badge badge-failed'
                      }
                    >
                      {r.status === 'completed'
                        ? '已完成'
                        : r.status === 'running'
                        ? '进行中'
                        : '失败'}
                    </span>
                  </td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.summary?.userImpact || '-'}
                  </td>
                  <td>
                    {r.recoveryResult ? (
                      r.recoveryPassed ? (
                        <span className="badge badge-success">通过</span>
                      ) : (
                        <span className="badge badge-failed">差异</span>
                      )
                    ) : (
                      <span className="muted">未执行</span>
                    )}
                  </td>
                  <td>
                    <div className="action-bar">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          drillApi.exportReport(r.id);
                        }}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {result && (
        <ResultDetail
          result={result}
          tab={tab}
          setTab={setTab}
          services={services}
          dependencies={dependencies}
          onRecovery={handleRecovery}
          loadingRecovery={loadingRecovery}
          onExport={() => drillApi.exportReport(result.id)}
        />
      )}
    </div>
  );
}

interface DetailProps {
  result: DrillResult;
  tab: string;
  setTab: (id: string) => void;
  services: any[];
  dependencies: any[];
  onRecovery: () => void;
  loadingRecovery: boolean;
  onExport: () => void;
}

function ResultDetail({
  result,
  tab,
  setTab,
  services,
  dependencies,
  onRecovery,
  loadingRecovery,
  onExport,
}: DetailProps) {
  const plan = {
    injectedFaults: result.summary?.faultInjections?.map((f: any) => ({
      serviceId: f.service,
      faultType: f.fault,
    })) || [],
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <h2>{result.planName} - 演练详情</h2>
        <div className="action-bar">
          {!result.recoveryResult && (
            <button
              className="btn btn-success"
              onClick={onRecovery}
              disabled={loadingRecovery}
            >
              {loadingRecovery ? <RefreshCw size={16} className="spinner" /> : <RefreshCw size={16} />}
              {loadingRecovery ? '复测中...' : '执行恢复复测'}
            </button>
          )}
          <button className="btn btn-primary" onClick={onExport}>
            <Download size={16} /> 导出报告
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab result={result} plan={plan} services={services} dependencies={dependencies} />}
      {tab === 'baseline' && <ResultItemTab item={result.baselineResult} title="基线测试（无故障注入）" services={services} dependencies={dependencies} />}
      {tab === 'degraded' && <ResultItemTab item={result.degradedResult} title="故障注入测试" plan={plan} services={services} dependencies={dependencies} />}
      {tab === 'comparison' && <ComparisonTab result={result} />}
      {tab === 'recovery' && (
        result.recoveryResult ? (
          <RecoveryTab result={result} services={services} dependencies={dependencies} />
        ) : (
          <div className="empty">尚未执行恢复复测。点击上方按钮执行。</div>
        )
      )}
    </div>
  );
}

function OverviewTab({ result, plan, services, dependencies }: any) {
  return (
    <div>
      <div className="grid grid-2">
        <div>
          <div className="result-section">
            <h3>基本信息</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="muted">开始时间</div>
                <div>{result.startedAt}</div>
              </div>
              <div>
                <div className="muted">结束时间</div>
                <div>{result.completedAt || '-'}</div>
              </div>
              <div>
                <div className="muted">状态</div>
                <div>
                  <span className={result.status === 'completed' ? 'badge badge-success' : 'badge badge-failed'}>
                    {result.status === 'completed' ? '成功' : '失败'}
                  </span>
                </div>
              </div>
              <div>
                <div className="muted">命中规则</div>
                <div>
                  {result.degradedResult?.matchedRules?.length || 0} 条
                </div>
              </div>
            </div>
          </div>

          <div className="result-section">
            <h3>用户可见影响</h3>
            <div
              className={
                result.degradedResult?.blocked
                  ? 'alert alert-danger'
                  : result.degradedResult?.finalAction
                  ? 'alert alert-warning'
                  : 'alert alert-success'
              }
            >
              {result.degradedResult?.userVisibleResult || '无'}
            </div>
          </div>

          {result.degradedResult?.matchedRules?.length > 0 && (
            <div className="result-section">
              <h3>命中的降级规则</h3>
              {result.degradedResult.matchedRules.map((r: any) => (
                <div key={r.id} style={{ padding: 12, background: '#fefce8', borderRadius: 6, marginBottom: 8, borderLeft: '3px solid #eab308' }}>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  <div className="muted">{r.description}</div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      className={`badge badge-${
                        r.action === 'cache'
                          ? 'cache'
                          : r.action === 'fallback'
                          ? 'fallback'
                          : 'block'
                      }`}
                    >
                      {r.action === 'cache'
                        ? '返回缓存'
                        : r.action === 'fallback'
                        ? '返回兜底值'
                        : '阻断请求'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="result-section">
            <h3>服务拓扑（故障服务高亮）</h3>
            <TopologyCanvas
              services={services}
              dependencies={dependencies}
              injectedFaults={plan.injectedFaults}
              trace={result.degradedResult?.trace}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultItemTab({ item, title, plan, services, dependencies }: any) {
  if (!item) return <div className="empty">数据不可用</div>;

  return (
    <div>
      <div className={`alert ${item.success ? 'alert-success' : 'alert-danger'}`}>
        <strong>{title}</strong>
        <div style={{ marginTop: 8 }}>
          成功: {item.success ? '是' : '否'} | 被阻断: {item.blocked ? '是' : '否'}
        </div>
        <div style={{ marginTop: 4 }}>{item.userVisibleResult}</div>
      </div>

      <div className="grid grid-2">
        <div>
          <div className="result-section">
            <h3>请求链路</h3>
            <Timeline trace={item.trace} />
          </div>
        </div>
        <div>
          <div className="result-section">
            <h3>最终响应</h3>
            <pre className="json-pre">
              {JSON.stringify(item.response, null, 2)}
            </pre>
          </div>

          {item.matchedRules?.length > 0 && (
            <div className="result-section">
              <h3>命中规则</h3>
              {item.matchedRules.map((r: any) => (
                <div key={r.id} className="diff-item">
                  <div className="diff-item-field">{r.name}</div>
                  <div className="diff-item-values">{r.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonTab({ result }: { result: DrillResult }) {
  return (
    <div>
      {result.comparison?.hasDifferences ? (
        <div>
          <div className="alert alert-warning">
            ⚠️ 基线测试 vs 故障注入测试存在 {result.comparison.differences.length} 处差异
          </div>

          <div className="result-section">
            <h3>差异详情</h3>
            {result.comparison.differences.map((diff, idx) => (
              <div key={idx} className="diff-item">
                <div className="diff-item-field">{diff.field}</div>
                <div className="diff-item-values">
                  基线: <span>{JSON.stringify(diff.baseline)}</span>
                  → 故障: <span>{JSON.stringify(diff.test)}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  影响: {diff.impact}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="alert alert-success">
          ✅ 基线测试与故障注入测试结果一致（无差异）
        </div>
      )}

      <div className="compare-grid">
        <div className="compare-col">
          <h4>基线测试</h4>
          <div style={{ marginBottom: 8 }}>
            <span className={result.baselineResult?.success ? 'badge badge-success' : 'badge badge-failed'}>
              {result.baselineResult?.success ? '成功' : '失败'}
            </span>
          </div>
          <div className="muted">{result.baselineResult?.userVisibleResult}</div>
          {result.baselineResult?.matchedRules?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              命中规则: {result.baselineResult.matchedRules.map((r) => r.name).join(', ')}
            </div>
          )}
        </div>
        <div className="compare-col">
          <h4>故障注入测试</h4>
          <div style={{ marginBottom: 8 }}>
            <span className={result.degradedResult?.success ? 'badge badge-success' : 'badge badge-failed'}>
              {result.degradedResult?.success ? '成功' : '失败'}
            </span>
            {result.degradedResult?.blocked && (
              <span className="badge badge-block" style={{ marginLeft: 8 }}>
                被阻断
              </span>
            )}
          </div>
          <div className="muted">{result.degradedResult?.userVisibleResult}</div>
          {result.degradedResult?.matchedRules?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              命中规则: {result.degradedResult.matchedRules.map((r) => r.name).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecoveryTab({ result, services, dependencies }: any) {
  return (
    <div>
      <div className={`alert ${result.recoveryPassed ? 'alert-success' : 'alert-warning'}`}>
        <strong>恢复复测结果</strong>
        <div style={{ marginTop: 8 }}>
          {result.recoveryPassed
            ? '✅ 恢复后与基线一致，系统已恢复正常'
            : '⚠️ 恢复后与基线仍有差异，需进一步排查'}
        </div>
        <div className="muted" style={{ marginTop: 4 }}>
          复测时间: {result.recoveryRunAt}
        </div>
      </div>

      {result.recoveryComparison?.hasDifferences && (
        <div className="result-section">
          <h3>与基线的差异</h3>
          {result.recoveryComparison.differences.map((diff: any, idx: number) => (
            <div key={idx} className="diff-item">
              <div className="diff-item-field">{diff.field}</div>
              <div className="diff-item-values">
                基线: <span>{JSON.stringify(diff.baseline)}</span>
                → 恢复后: <span>{JSON.stringify(diff.test)}</span>
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                影响: {diff.impact}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="compare-grid">
        <div className="compare-col">
          <h4>基线测试</h4>
          <div style={{ marginBottom: 8 }}>
            <span className={result.baselineResult?.success ? 'badge badge-success' : 'badge badge-failed'}>
              {result.baselineResult?.success ? '成功' : '失败'}
            </span>
          </div>
          <div className="muted">{result.baselineResult?.userVisibleResult}</div>
        </div>
        <div className="compare-col">
          <h4>恢复后复测</h4>
          <div style={{ marginBottom: 8 }}>
            <span className={result.recoveryResult?.success ? 'badge badge-success' : 'badge badge-failed'}>
              {result.recoveryResult?.success ? '成功' : '失败'}
            </span>
          </div>
          <div className="muted">{result.recoveryResult?.userVisibleResult}</div>
        </div>
      </div>

      {result.recoveryResult?.trace && (
        <div className="result-section">
          <h3>恢复复测请求链路</h3>
          <Timeline trace={result.recoveryResult.trace} />
        </div>
      )}
    </div>
  );
}
