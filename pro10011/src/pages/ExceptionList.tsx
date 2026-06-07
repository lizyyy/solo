import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Eye, FileUp, CheckSquare, Square } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilterBar } from '../components/table/FilterBar';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useRecordStore } from '../store/useRecordStore';
import { formatCurrency, formatDate } from '../utils/fileParser';
import type { RecordStatus, ValuationRecord } from '../types';

const statusOptions: { value: RecordStatus; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'normal', label: '正常' },
  { value: 'abnormal', label: '异常' },
  { value: 'false_positive', label: '误命中' }
];

export const ExceptionList = () => {
  const navigate = useNavigate();
  const initRecords = useRecordStore(state => state.initRecords);
  const getFilteredRecords = useRecordStore(state => state.getFilteredRecords);
  const updateRecordStatus = useRecordStore(state => state.updateRecordStatus);
  const selectedRecordIds = useRecordStore(state => state.selectedRecordIds);
  const toggleRecordSelection = useRecordStore(state => state.toggleRecordSelection);
  const clearSelection = useRecordStore(state => state.clearSelection);
  const selectAll = useRecordStore(state => state.selectAll);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ValuationRecord | null>(null);
  const [newStatus, setNewStatus] = useState<RecordStatus>('pending');
  const [newRemark, setNewRemark] = useState('');

  useEffect(() => {
    initRecords();
  }, [initRecords]);

  const records = getFilteredRecords();

  const handleEdit = (record: ValuationRecord) => {
    setEditingRecord(record);
    setNewStatus(record.currentStatus);
    setNewRemark(record.currentRemark);
    setEditModalOpen(true);
  };

  const handleSave = () => {
    if (!editingRecord) return;
    
    updateRecordStatus(
      editingRecord.id,
      newStatus,
      newRemark,
      '清算专员'
    );
    
    setEditModalOpen(false);
    setEditingRecord(null);
  };

  const handleSelectAll = () => {
    if (selectedRecordIds.length === records.length) {
      clearSelection();
    } else {
      selectAll(records.map(r => r.id));
    }
  };

  const isAllSelected = records.length > 0 && selectedRecordIds.length === records.length;

  return (
    <Layout title="异常列表">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">异常记录列表</h2>
            <p className="text-sm text-gray-500 mt-1">共 {records.length} 条记录</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRecordIds.length > 0 && (
              <span className="text-sm text-gray-500">
                已选 {selectedRecordIds.length} 项
              </span>
            )}
            <button
              onClick={() => navigate('/import')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
            >
              <FileUp size={14} />
              导入材料
            </button>
          </div>
        </div>

        <FilterBar />

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 py-3 px-3">
                    <button onClick={handleSelectAll} className="text-gray-400 hover:text-gray-600">
                      {isAllSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">交易编号</th>
                  <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">交易对手</th>
                  <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">产品类型</th>
                  <th className="text-right text-xs font-medium text-gray-500 py-3 px-3">名义本金</th>
                  <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">版本数</th>
                  <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">当前状态</th>
                  <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">当前说明</th>
                  <th className="text-left text-xs font-medium text-gray-500 py-3 px-3">更新时间</th>
                  <th className="text-center text-xs font-medium text-gray-500 py-3 px-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr 
                    key={record.id} 
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
                      record.currentStatus === 'abnormal' ? 'bg-red-50/30' : ''
                    } ${
                      selectedRecordIds.includes(record.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <button 
                        onClick={() => toggleRecordSelection(record.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {selectedRecordIds.includes(record.id) 
                          ? <CheckSquare size={16} className="text-blue-600" /> 
                          : <Square size={16} />
                        }
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => navigate(`/record/${record.id}`)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-mono"
                      >
                        {record.tradeId}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-900">{record.counterparty}</td>
                    <td className="py-3 px-3 text-sm text-gray-600">{record.productType}</td>
                    <td className="py-3 px-3 text-sm text-gray-900 text-right font-mono">
                      {formatCurrency(record.notionalAmount)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-gray-100 text-gray-700 rounded-sm">
                        {record.versions.length}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={record.currentStatus} />
                      {record.isFalsePositive && record.currentStatus !== 'false_positive' && (
                        <span className="ml-2 text-xs text-gray-400">(标记误命中)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-600 max-w-xs truncate" title={record.currentRemark}>
                      {record.currentRemark || '-'}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-500">
                      {formatDate(record.updatedAt)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/record/${record.id}`)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                          title="查看详情"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-sm transition-colors"
                          title="人工改判"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-gray-400 text-sm">
                      暂无符合条件的记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="人工改判"
        footer={
          <>
            <button
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-sm hover:bg-blue-700 transition-colors"
            >
              确认改判
            </button>
          </>
        }
      >
        {editingRecord && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-sm border border-gray-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">交易编号</p>
                  <p className="font-mono text-gray-900">{editingRecord.tradeId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">交易对手</p>
                  <p className="text-gray-900">{editingRecord.counterparty}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">当前状态</p>
                  <StatusBadge status={editingRecord.currentStatus} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">版本数</p>
                  <p className="text-gray-900">{editingRecord.versions.length} 个版本</p>
                </div>
              </div>
            </div>

            {editingRecord.currentRemark && (
              <div className="bg-gray-50 p-3 rounded-sm border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">当前说明（将作为旧理由留存）</p>
                <p className="text-sm text-gray-500 italic line-through">{editingRecord.currentRemark}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新状态 <span className="text-red-500">*</span>
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as RecordStatus)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded-sm focus:border-blue-400 focus:outline-none bg-white"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                改判理由 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                placeholder="请填写改判理由，旧理由将自动留存至历史记录"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:border-blue-400 focus:outline-none resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                提示：改判后旧状态和旧理由将自动保存到历史记录中，不可删除
              </p>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};
