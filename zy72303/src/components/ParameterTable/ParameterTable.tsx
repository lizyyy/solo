import { useState } from 'react';
import { useAppContext } from '../../store/AppContext';
import {
  getStakeholderName,
  getStatusName,
  formatDenominatorDisplay,
  parseDenominatorInput,
} from '../../utils/dataUtils';
import { Edit2, History, AlertTriangle, CheckCircle, Clock, Save, X } from 'lucide-react';
import type { ParameterRecord, Stakeholder } from '../../types';

interface ParameterTableProps {
  onSelectRecord: (recordId: string) => void;
  selectedRecordId: string | null;
  onShowHistory: (recordId: string, fromVersion: number, toVersion: number) => void;
}

export function ParameterTable({ onSelectRecord, selectedRecordId, onShowHistory }: ParameterTableProps) {
  const { state, dispatch } = useAppContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState('');
  const [editDenominator, setEditDenominator] = useState('');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'zero_denominator':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'needs_review':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'counterexample_provided':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'demo_ready':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'normal':
        return <CheckCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const startEdit = (record: ParameterRecord) => {
    setEditingId(record.id);
    setEditRemark(record.remark);
    setEditDenominator(formatDenominatorDisplay(record.denominator, record.denominatorDisplayEmpty));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRemark('');
    setEditDenominator('');
  };

  const saveEdit = (record: ParameterRecord) => {
    const denParsed = parseDenominatorInput(editDenominator);
    const changes: Partial<ParameterRecord> = {
      remark: editRemark,
      denominator: denParsed.value,
      denominatorDisplayEmpty: denParsed.displayEmpty,
    };
    if (denParsed.displayEmpty) {
      changes.status = 'zero_denominator';
      changes.assignedTo = 'data_reviewer';
    } else if (record.status === 'zero_denominator' && !denParsed.displayEmpty && denParsed.value !== 0) {
      changes.status = 'needs_review';
      changes.assignedTo = 'alan';
    }

    dispatch({
      type: 'UPDATE_PARAMETER_RECORD',
      payload: {
        id: record.id,
        changes,
        author: state.currentUser as Stakeholder,
        description: editRemark !== record.remark ? '修改备注' : '修改分母值',
      },
    });
    cancelEdit();
  };

  const zeroDenomCount = state.parameterRecords.filter(
    r => r.status === 'zero_denominator'
  ).length;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">参数调试表</h2>
            <p className="text-indigo-100 text-sm mt-1">
              共 {state.parameterRecords.length} 条记录
              {zeroDenomCount > 0 && (
                <span className="ml-3 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs">
                  ⚠️ {zeroDenomCount} 条分母为0待复核
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-indigo-100 text-sm">当前用户</p>
            <p className="text-white font-semibold">
              {getStakeholderName(state.currentUser as Stakeholder)}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                起点
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                终点
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                分子
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                分母
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                边权重
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                备注
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                负责人
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                版本
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.parameterRecords.map(record => {
              const isEditing = editingId === record.id;
              const isSelected = selectedRecordId === record.id;
              const isZeroDenom = record.status === 'zero_denominator';

              return (
                <tr
                  key={record.id}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-indigo-50'
                      : isZeroDenom
                      ? 'bg-amber-50 hover:bg-amber-100'
                      : 'hover:bg-gray-50'
                  } cursor-pointer`}
                  onClick={() => !isEditing && onSelectRecord(record.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" title={getStatusName(record.status)}>
                      {getStatusIcon(record.status)}
                      <span className="text-xs text-gray-500">
                        {getStatusName(record.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                      {record.sourceNode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                      {record.targetNode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {record.numerator}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDenominator}
                        onChange={e => setEditDenominator(e.target.value)}
                        placeholder="空或0表示异常"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className={`font-mono ${
                          isZeroDenom ? 'text-amber-600 font-semibold' : ''
                        }`}
                        title={isZeroDenom ? '分母为0，显示为空' : ''}
                      >
                        {formatDenominatorDisplay(
                          record.denominator,
                          record.denominatorDisplayEmpty
                        )}
                        {isZeroDenom && (
                          <span className="ml-1 text-xs text-amber-500">⚠️</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {record.edgeWeight.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editRemark}
                        onChange={e => setEditRemark(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-gray-700 truncate block" title={record.remark}>
                        {record.remark}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        record.assignedTo === 'data_reviewer'
                          ? 'bg-purple-100 text-purple-700'
                          : record.assignedTo === 'alan'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {getStakeholderName(record.assignedTo as Stakeholder)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-500">
                      v{record.currentVersion}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(record)}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                            title="保存"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="取消"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(record)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {record.currentVersion > 1 && (
                            <button
                              onClick={() =>
                                onShowHistory(record.id, 1, record.currentVersion)
                              }
                              className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                              title="查看历史"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {state.parameterRecords.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <p>暂无参数记录，请导入参数调试表</p>
        </div>
      )}
    </div>
  );
}
