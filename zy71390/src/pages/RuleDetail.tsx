import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, RotateCcw, GitCompare, Check, X } from 'lucide-react';
import { useStore } from '@/store';
import RuleVersionDiff from '@/components/RuleVersionDiff';
import Skeleton, { TableSkeleton } from '@/components/Skeleton';
import type { RuleVersion } from '../../shared/types';
import { STATUS_COLORS, STATUS_LABELS, TIER_COLORS, TIER_LABELS } from '../../shared/types';

export default function RuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rules = useStore((state) => state.rules);
  const ruleVersions = useStore((state) => state.ruleVersions);
  const fetchRule = useStore((state) => state.fetchRule);
  const getRuleVersions = useStore((state) => state.getRuleVersions);
  const rollbackRule = useStore((state) => state.rollbackRule);
  const ruleLoading = useStore((state) => state.loading[`rule:${id}`]);
  const versionsLoading = useStore((state) => state.loading[`ruleVersions:${id}`]);
  const rollbackLoading = useStore((state) => state.loading[`rollbackRule:${id}`]);
  const error = useStore((state) => state.error);

  const [oldVersionId, setOldVersionId] = useState<string>('');
  const [newVersionId, setNewVersionId] = useState<string>('');
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackToVersion, setRollbackToVersion] = useState<number | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');

  const rule = rules.find((r) => r.id === id);

  useEffect(() => {
    if (id) {
      fetchRule(id);
      getRuleVersions(id);
    }
  }, [id, fetchRule, getRuleVersions]);

  const oldVersion = ruleVersions.find((v) => v.id === oldVersionId);
  const newVersion = ruleVersions.find((v) => v.id === newVersionId);

  const handleRollback = async () => {
    if (!id || rollbackToVersion === null || !rollbackReason.trim()) return;
    const result = await rollbackRule(id, rollbackToVersion, rollbackReason);
    if (result) {
      setShowRollbackDialog(false);
      setRollbackToVersion(null);
      setRollbackReason('');
      getRuleVersions(id);
    }
  };

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/rules')}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          {ruleLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <h1 className="text-2xl font-bold text-white">
              {rule?.name || '规则详情'}
            </h1>
          )}
        </div>
        <Link
          to={`/rules/new?id=${id}`}
          className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          编辑
        </Link>
      </div>

      {ruleLoading ? (
        <div className="card p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      ) : rule ? (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">基本信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">规则名称</span>
              <span className="text-white font-medium">{rule.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">接口路径</span>
              <code className="text-slate-300 bg-dark px-2 py-0.5 rounded">
                {rule.path}
              </code>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">请求方法</span>
              <span className="text-white">{rule.method}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">时间窗</span>
              <span className="text-white">{rule.windowSize} 秒</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">阈值</span>
              <span className="text-white">{rule.limit} 次</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">适用层级</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${TIER_COLORS[rule.tier]}20`,
                  color: TIER_COLORS[rule.tier],
                }}
              >
                {TIER_LABELS[rule.tier]}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">当前版本</span>
              <span className="text-white">v{rule.currentVersion}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">状态</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${STATUS_COLORS[rule.status]}20`,
                  color: STATUS_COLORS[rule.status],
                }}
              >
                {STATUS_LABELS[rule.status]}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">创建时间</span>
              <span className="text-slate-300">
                {new Date(rule.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-200">
              <span className="text-slate-400">更新时间</span>
              <span className="text-slate-300">
                {new Date(rule.updatedAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">版本历史</h3>
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-slate-400" />
            <select
              value={oldVersionId}
              onChange={(e) => setOldVersionId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-dark border border-dark-200 text-white text-sm focus:outline-none focus:border-primary"
            >
              <option value="">选择旧版本</option>
              {ruleVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>
            <span className="text-slate-400">vs</span>
            <select
              value={newVersionId}
              onChange={(e) => setNewVersionId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-dark border border-dark-200 text-white text-sm focus:outline-none focus:border-primary"
            >
              <option value="">选择新版本</option>
              {ruleVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>
          </div>
        </div>

        {versionsLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    版本
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    修改人
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    修改理由
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    时间
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-200">
                {ruleVersions.map((version: RuleVersion) => (
                  <tr
                    key={version.id}
                    className="hover:bg-dark-100/50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-white font-medium">v{version.version}</span>
                      {version.version === rule?.currentVersion && (
                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-success/20 text-success">
                          当前
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {version.modifiedBy}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                      {version.changeReason}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                      {new Date(version.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {version.version !== rule?.currentVersion && (
                        <button
                          onClick={() => {
                            setRollbackToVersion(version.version);
                            setShowRollbackDialog(true);
                            setRollbackReason('');
                          }}
                          className="px-3 py-1 rounded text-xs bg-warning/20 text-warning hover:bg-warning/30 transition-colors flex items-center gap-1 ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          回滚
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(oldVersion || newVersion) && (
        <RuleVersionDiff oldVersion={oldVersion} newVersion={newVersion} />
      )}

      {showRollbackDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">确认回滚</h3>
            <p className="text-slate-400 mb-4">
              确定要回滚到版本 <span className="text-warning font-medium">v{rollbackToVersion}</span> 吗？
              这将创建一个新的版本。
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                回滚理由 <span className="text-danger">*</span>
              </label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="请输入回滚理由..."
                className="w-full px-4 py-2 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRollbackDialog(false);
                  setRollbackToVersion(null);
                }}
                className="px-4 py-2 rounded-lg bg-dark-200 text-white hover:bg-dark-300 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                取消
              </button>
              <button
                onClick={handleRollback}
                disabled={!rollbackReason.trim() || rollbackLoading}
                className="px-4 py-2 rounded-lg bg-warning text-white hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                确认回滚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
