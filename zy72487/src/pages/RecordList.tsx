import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, AlertTriangle, FileText } from 'lucide-react';
import { useRecordStore } from '@/stores/useRecordStore';
import { RecordStatusBadge, ConflictStatusBadge, NameStatusBadge } from '@/components/StatusBadges';
import ImportModal from '@/components/ImportModal';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function RecordList() {
  const { records, loading, error, fetchAll, importRecord } = useRecordStore();
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredRecords = records.filter(
    (r) =>
      r.redLineNo.toLowerCase().includes(search.toLowerCase()) ||
      r.communityName.toLowerCase().includes(search.toLowerCase())
  );

  const handleImport = async (data: {
    redLineNo: string;
    communityName: string;
    communityNameOld?: string;
    redLineRemark: string;
  }) => {
    await importRecord(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">验收记录管理</h2>
          <p className="text-sm text-slate-500 mt-1">
            管理道路开挖恢复验收记录，支持导入、复核、导出全流程
          </p>
        </div>
        <button onClick={() => setShowImport(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          导入红线图备注
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索红线图编号或小区名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded text-danger-700 text-sm">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-header">红线图编号</th>
                <th className="table-header">小区名称</th>
                <th className="table-header">验收状态</th>
                <th className="table-header">冲突状态</th>
                <th className="table-header">名称状态</th>
                <th className="table-header">导入时间</th>
                <th className="table-header">操作人</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-slate-900">{record.redLineNo}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {record.communityName}
                        {record.communityNameOld && (
                          <span className="text-xs text-warning-600">
                            （{record.communityNameOld}）
                          </span>
                        )}
                        {record.hasNameIssue && record.nameReviewStatus === 'pending' && (
                          <AlertTriangle className="w-4 h-4 text-warning-500" />
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <RecordStatusBadge status={record.status} />
                    </td>
                    <td className="table-cell">
                      <ConflictStatusBadge
                        hasConflict={record.hasConflict}
                        status={record.conflictStatus}
                      />
                    </td>
                    <td className="table-cell">
                      <NameStatusBadge
                        hasNameIssue={record.hasNameIssue}
                        status={record.nameReviewStatus}
                      />
                    </td>
                    <td className="table-cell text-slate-500">
                      {format(new Date(record.importTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </td>
                    <td className="table-cell text-slate-500">{record.operator}</td>
                    <td className="table-cell">
                      <Link
                        to={`/record/${record.id}`}
                        className="inline-flex items-center gap-1 text-municipal-600 hover:text-municipal-800 text-sm font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        loading={loading}
      />
    </div>
  );
}
