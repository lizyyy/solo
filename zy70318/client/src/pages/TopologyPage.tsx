import { useState } from 'react';
import { useAppStore } from '../store';
import TopologyCanvas from '../components/TopologyCanvas';

export default function TopologyPage() {
  const services = useAppStore((s) => s.services);
  const dependencies = useAppStore((s) => s.dependencies);
  const rules = useAppStore((s) => s.rules);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === selected);
  const relatedRules = rules.filter((r) => r.targetService === selected);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>服务依赖拓扑</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span className="badge badge-core">核心服务</span>
            <span className="badge badge-non-core">非核心服务</span>
          </div>
        </div>

        <TopologyCanvas
          services={services}
          dependencies={dependencies}
          selectedService={selected || undefined}
          onSelect={setSelected}
        />

        <div style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
          提示：点击服务节点查看详情和关联的降级规则
        </div>
      </div>

      {selectedService && (
        <div className="card">
          <div className="card-header">
            <h2>
              {selectedService.name}
              <span
                className={`badge ${
                  selectedService.role === 'core' ? 'badge-core' : 'badge-non-core'
                }`}
                style={{ marginLeft: 12 }}
              >
                {selectedService.role === 'core' ? '核心服务' : '非核心服务'}
              </span>
            </h2>
          </div>

          <p style={{ marginBottom: 16, color: '#475569' }}>
            {selectedService.description}
          </p>

          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#334155' }}>
            关联的降级规则 ({relatedRules.length})
          </h3>

          {relatedRules.length === 0 ? (
            <div className="muted">暂无配置降级规则</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>规则名称</th>
                  <th>动作</th>
                  <th>触发条件</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {relatedRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{rule.name}</div>
                      <div className="muted">{rule.description}</div>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          rule.action === 'block'
                            ? 'block'
                            : rule.action === 'cache'
                            ? 'cache'
                            : rule.action === 'fallback'
                            ? 'fallback'
                            : 'disabled'
                        }`}
                      >
                        {rule.action === 'cache'
                          ? '返回缓存'
                          : rule.action === 'fallback'
                          ? '返回兜底值'
                          : rule.action === 'block'
                          ? '阻断请求'
                          : '不降级'}
                      </span>
                    </td>
                    <td>{rule.conditions.status.join(', ')}</td>
                    <td>
                      <span className={rule.enabled ? 'badge badge-enabled' : 'badge badge-disabled'}>
                        {rule.enabled ? '启用' : '禁用'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
