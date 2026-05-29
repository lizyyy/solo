interface Props { status: string; type?: 'exception' | 'report' | 'review' }

export default function StatusBadge({ status, type = 'exception' }: Props) {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    reviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    kept: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    removed: 'bg-red-500/20 text-red-400 border-red-500/30',
    added: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    modified: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    static: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dynamic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  const labelMap: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    reviewed: '已复核',
    rejected: '已拒绝',
    expired: '已过期',
    draft: '草稿',
    kept: '保留',
    removed: '移除',
    added: '新增',
    modified: '修改',
    static: '静态',
    dynamic: '动态',
  };

  return (
    <span className={`badge border ${map[status] || map.pending}`}>
      {labelMap[status] || status}
    </span>
  );
}
