import type { RuleVersion } from '../../shared/types';
import { STATUS_LABELS, TIER_LABELS } from '../../shared/types';
import { cn } from '@/lib/utils';

interface RuleVersionDiffProps {
  oldVersion?: RuleVersion;
  newVersion?: RuleVersion;
}

interface DiffField {
  field: string;
  oldValue: string;
  newValue: string;
  changed: boolean;
  label: string;
}

export default function RuleVersionDiff({ oldVersion, newVersion }: RuleVersionDiffProps) {
  if (!oldVersion && !newVersion) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-400">请选择两个版本进行对比</p>
      </div>
    );
  }

  const oldData = oldVersion?.snapshot;
  const newData = newVersion?.snapshot;

  const diffFields: DiffField[] = [
    {
      label: '规则名称',
      field: 'name',
      oldValue: oldData?.name || '-',
      newValue: newData?.name || '-',
      changed: oldData?.name !== newData?.name,
    },
    {
      label: '接口路径',
      field: 'path',
      oldValue: oldData?.path || '-',
      newValue: newData?.path || '-',
      changed: oldData?.path !== newData?.path,
    },
    {
      label: '请求方法',
      field: 'method',
      oldValue: oldData?.method || '-',
      newValue: newData?.method || '-',
      changed: oldData?.method !== newData?.method,
    },
    {
      label: '时间窗(秒)',
      field: 'windowSize',
      oldValue: String(oldData?.windowSize || '-'),
      newValue: String(newData?.windowSize || '-'),
      changed: oldData?.windowSize !== newData?.windowSize,
    },
    {
      label: '阈值',
      field: 'limit',
      oldValue: String(oldData?.limit || '-'),
      newValue: String(newData?.limit || '-'),
      changed: oldData?.limit !== newData?.limit,
    },
    {
      label: '适用层级',
      field: 'tier',
      oldValue: oldData?.tier ? TIER_LABELS[oldData.tier] : '-',
      newValue: newData?.tier ? TIER_LABELS[newData.tier] : '-',
      changed: oldData?.tier !== newData?.tier,
    },
    {
      label: '状态',
      field: 'status',
      oldValue: oldData?.status ? STATUS_LABELS[oldData.status] : '-',
      newValue: newData?.status ? STATUS_LABELS[newData.status] : '-',
      changed: oldData?.status !== newData?.status,
    },
  ];

  const changedFields = diffFields.filter((f) => f.changed);
  const unchangedFields = diffFields.filter((f) => !f.changed);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-lg font-semibold text-white">版本对比</h4>
        {changedFields.length > 0 && (
          <span className="px-3 py-1 rounded-full bg-warning/20 text-warning text-sm">
            {changedFields.length} 处变更
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {oldVersion && (
          <div className="p-4 rounded-lg bg-dark-100">
            <div className="text-xs text-slate-400 mb-1">旧版本</div>
            <div className="text-white font-medium">v{oldVersion.version}</div>
            <div className="text-sm text-slate-400 mt-1">
              {oldVersion.modifiedBy} ·{' '}
              {new Date(oldVersion.createdAt).toLocaleString('zh-CN')}
            </div>
            <div className="text-sm text-slate-300 mt-2">
              修改理由: {oldVersion.changeReason}
            </div>
          </div>
        )}
        {newVersion && (
          <div className="p-4 rounded-lg bg-dark-100">
            <div className="text-xs text-slate-400 mb-1">新版本</div>
            <div className="text-white font-medium">v{newVersion.version}</div>
            <div className="text-sm text-slate-400 mt-1">
              {newVersion.modifiedBy} ·{' '}
              {new Date(newVersion.createdAt).toLocaleString('zh-CN')}
            </div>
            <div className="text-sm text-slate-300 mt-2">
              修改理由: {newVersion.changeReason}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {changedFields.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-white mb-3">变更字段</h5>
            <div className="overflow-x-auto rounded-lg border border-dark-200">
              <table className="w-full text-sm">
                <thead className="bg-dark-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">字段</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">旧值</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">新值</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200">
                  {changedFields.map((field) => (
                    <tr key={field.field} className="bg-danger/5">
                      <td className="px-4 py-3 text-slate-300">{field.label}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'px-2 py-1 rounded text-danger line-through',
                          'bg-danger/10'
                        )}>
                          {field.oldValue}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'px-2 py-1 rounded text-success',
                          'bg-success/10'
                        )}>
                          {field.newValue}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {unchangedFields.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-white mb-3">未变更字段</h5>
            <div className="grid grid-cols-2 gap-4">
              {unchangedFields.map((field) => (
                <div key={field.field} className="flex justify-between py-2 px-4 bg-dark-100 rounded-lg">
                  <span className="text-slate-400">{field.label}</span>
                  <span className="text-slate-300 font-mono">{field.oldValue}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
