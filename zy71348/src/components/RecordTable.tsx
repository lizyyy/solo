import { useState } from 'react';
import { useRecordStore } from '@/store/useRecordStore';
import { StatusBadge } from './StatusBadge';
import { ConditionBadge } from './ConditionBadge';
import { ExceptionBadge } from './ExceptionBadge';
import { Edit, Eye, Trash2, AlertTriangle, Disc } from 'lucide-react';
import type { InventoryRecord } from '@/types';
import { isModifiable } from '@/utils/stateMachine';

interface RecordTableProps {
  onEdit: (record: InventoryRecord) => void;
  onView: (record: InventoryRecord) => void;
}

export function RecordTable({ onEdit, onView }: RecordTableProps) {
  const filteredRecords = useRecordStore((s) => s.getFilteredRecords());
  const getRecordExceptions = useRecordStore((s) => s.getRecordExceptions);
  const deleteRecord = useRecordStore((s) => s.deleteRecord);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      deleteRecord(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  if (filteredRecords.length === 0) {
    return (
      <div className="card text-center py-12">
        <Disc className="w-12 h-12 text-vinyl-700/30 mx-auto mb-3" />
        <p className="text-vinyl-600">暂无记录</p>
        <p className="text-sm text-vinyl-500 mt-1">点击右上角按钮录入第一张唱片</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left font-medium">版号</th>
              <th className="px-4 py-3 text-left font-medium">专辑 / 艺人</th>
              <th className="px-4 py-3 text-left font-medium">品相</th>
              <th className="px-4 py-3 text-left font-medium">价格</th>
              <th className="px-4 py-3 text-left font-medium">寄售人</th>
              <th className="px-4 py-3 text-left font-medium">位置</th>
              <th className="px-4 py-3 text-left font-medium">状态</th>
              <th className="px-4 py-3 text-left font-medium">异常</th>
              <th className="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record, idx) => {
              const exceptions = getRecordExceptions(record.id).filter(
                (e) => !e.resolved
              );
              const hasExceptions = exceptions.length > 0;
              const modifiable = isModifiable(record.status);

              return (
                <tr
                  key={record.id}
                  className={`border-b border-vinyl-700/10 table-row-hover animate-fade-in ${
                    idx % 2 === 1 ? 'table-row-alt' : ''
                  } ${hasExceptions ? 'exception-highlight' : ''}`}
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-vinyl-900">
                      {record.catalogNumber || '-'}
                    </div>
                    {record.versionTag && record.versionTag !== record.catalogNumber && (
                      <div className="text-xs text-caramel-500 mt-0.5">
                        {record.versionTag}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-vinyl-900">
                      {record.albumName || '-'}
                    </div>
                    <div className="text-xs text-vinyl-600">
                      {record.artist} ({record.pressYear})
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ConditionBadge condition={record.condition} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-vinyl-900">
                    ¥{record.price?.toFixed(2) || '-'}
                  </td>
                  <td className="px-4 py-3 text-vinyl-700">
                    {record.consignor || '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-vinyl-700">
                    {record.shelfLocation || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3">
                    {hasExceptions ? (
                      <div className="flex flex-wrap gap-1">
                        {exceptions.slice(0, 2).map((e) => (
                          <ExceptionBadge
                            key={e.id}
                            type={e.type}
                            resolved={e.resolved}
                          />
                        ))}
                        {exceptions.length > 2 && (
                          <span className="text-xs text-alert-500">
                            +{exceptions.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-vinyl-400 text-xs">正常</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="p-1.5 rounded-sm hover:bg-vinyl-700/10 transition-colors text-vinyl-700"
                        onClick={() => onView(record)}
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {modifiable && (
                        <button
                          className="p-1.5 rounded-sm hover:bg-vinyl-700/10 transition-colors text-vinyl-700"
                          onClick={() => onEdit(record)}
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {modifiable && (
                        <button
                          className={`p-1.5 rounded-sm transition-colors ${
                            deleteConfirm === record.id
                              ? 'bg-alert-500 text-white'
                              : 'hover:bg-alert-500/10 text-alert-500'
                          }`}
                          onClick={() => handleDelete(record.id)}
                          title={deleteConfirm === record.id ? '再次确认删除' : '删除'}
                        >
                          {deleteConfirm === record.id ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
