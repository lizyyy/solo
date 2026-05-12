import type { TraceEvent } from '../types';

interface Props {
  trace: TraceEvent[];
}

const EVENT_CLASS: Record<string, string> = {
  FAULT_INJECTED: 'fault',
  RULE_MATCHED: 'rule',
  DEGRADE_CACHE: 'rule',
  DEGRADE_FALLBACK: 'rule',
  DEGRADE_BLOCK: 'block',
  CACHE_EXPIRED: 'fault',
  CORE_BLOCK_NO_SILENT: 'block',
  CORE_BLOCK_NO_RULE: 'block',
  CALL_SUCCESS: 'success',
  REQUEST_COMPLETE: 'success',
};

const EVENT_LABEL: Record<string, string> = {
  REQUEST_START: '请求开始',
  CALL_SUCCESS: '调用成功',
  FAULT_INJECTED: '注入故障',
  RULE_MATCHED: '匹配降级规则',
  DEGRADE_CACHE: '降级: 返回缓存',
  DEGRADE_FALLBACK: '降级: 返回兜底值',
  DEGRADE_BLOCK: '降级: 阻断请求',
  CACHE_EXPIRED: '缓存已过期',
  CORE_BLOCK_NO_SILENT: '核心接口阻断',
  CORE_BLOCK_NO_RULE: '核心接口无规则阻断',
  NO_RULE_MATCHED: '无匹配规则',
  NO_DEGRADE_CONFIGURED: '无降级配置',
  REQUEST_COMPLETE: '请求完成',
};

export default function Timeline({ trace }: Props) {
  return (
    <div className="timeline">
      {trace.map((t) => {
        const cls = EVENT_CLASS[t.event] || '';
        const label = EVENT_LABEL[t.event] || t.event;

        return (
          <div key={t.id} className={`timeline-item ${cls}`}>
            <div className="timeline-time">
              {t.timestamp.split('T')[1].split('.')[0]}
            </div>
            <div className="timeline-service">{t.serviceId}</div>
            <div className="timeline-event">{label}</div>
            {t.data && Object.keys(t.data).length > 0 && (
              <div className="timeline-data">
                {JSON.stringify(t.data, null, 2).substring(0, 500)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
