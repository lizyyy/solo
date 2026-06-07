import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, FileText, History, User, Clock } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { VersionTimeline } from '../components/timeline/VersionTimeline';
import { JudgmentHistory } from '../components/timeline/JudgmentHistory';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useRecordStore } from '../store/useRecordStore';
import { formatCurrency, formatDate } from '../utils/fileParser';
import type { RecordStatus } from '../types';

const statusOptions: { value: RecordStatus; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'normal', label: '正常' },
  { value: 'abnormal', label: '异常' },
  { value: 'false_positive', label: '误命中' }
];

export const RecordDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const initRecords = useRecordStore(state => state.initRecords);
  const getRecordById = useRecordStore(state => state.getRecordById);
  const updateRecordStatus = useRecordStore(state => state.updateRecordStatus);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<RecordStatus>('pending');
  const [newRemark, setNewRemark] = useState('');
  const [activeTab, setActiveTab] = useState<'versions' | 'judgments'>('versions');

  useEffect(() => {
    initRecords();
  }, [initRecords]);

  const record = id ? getRecordById(id) : undefined;

  const handleEdit = () => {
    if (!record) return;
    setNewStatus(record.currentStatus);
    setNewRemark(record.currentRemark);
    setEditModalOpen(true);
  };

  const handleSave = () => {
    if (!record) return;
    
    updateRecordStatus(
      record.id,
      newStatus,
      newRemark,
      '清算专员'
    );
    
    setEditModalOpen(false);
  };

  if (!record) {
    return (
      <Layout title="记录详情">
        <div className="text-center py-12 text-gray-500">
          <p>记录不存在或已被删除</p>
          <button
            onClick={() => navigate('/exceptions')}
            className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
          >
            返回异常列表
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="记录详情">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/exceptions')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-gray-900 font-mono">{record.tradeId}</h2>
                <StatusBadge status={record.currentStatus} />
              </div>
              <p className="text-sm text-gray-500 mt-1">{record.counterparty} · {record.productType}</p>
            </div>
          </div>
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-sm hover:bg-blue-700 transition-colors"
          >
            <Edit3 size={14} />
            人工改判
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-xs text-gray-500 mb-1">名义本金</p>
            <p className="text-lg font-semibold text-gray-900 font-mono">{formatCurrency(record.notionalAmount)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-xs text-gray-500 mb-1">估值版本数</p>
            <p className="text-lg font-semibold text-gray-900">{record.versions.length} 个版本</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-xs text-gray-500 mb-1">改判次数</p>
            <p className="text-lg font-semibold text-gray-900">{record.judgments.length} 次</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <p className="text-xs text-gray-500 mb-1">最后更新</p>
            <p className="text-sm font-semibold text-gray-900">{formatDate(record.updatedAt)}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">基本信息</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">交易编号</p>
              <p className="text-sm text-gray-900 font-mono">{record.tradeId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">交易对手</p>
              <p className="text-sm text-gray-900">{record.counterparty}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">产品类型</p>
              <p className="text-sm text-gray-900">{record.productType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">创建时间</p>
              <p className="text-sm text-gray-900">{formatDate(record.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">名单误命中</p>
              <p className="text-sm text-gray-900">{record.isFalsePositive ? '是' : '否'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">当前状态</p>
              <StatusBadge status={record.currentStatus} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">当前说明</p>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-sm border border-gray-100">
              {record.currentRemark || '无'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === 'versions'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText size={16} />
              估值版本链路
            </button>
            <button
              onClick={() => setActiveTab('judgments')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === 'judgments'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <History size={16} />
              人工改判历史
              {record.judgments.length > 0 && (
                <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                  {record.judgments.length}
                </span>
              )}
            </button>
          </div>
          
          <div className="p-5">
            {activeTab === 'versions' ? (
              <div>
                <p className="text-xs text-gray-500 mb-4">
                  按时间顺序展示所有估值版本，各版本的临时说明已聚合到一起，可完整追踪从初版到最终结论的全过程
                </p>
                <VersionTimeline versions={record.versions} />
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-4">
                  所有人工改判记录，旧状态和旧理由均已留存，不可删除或修改
                </p>
                <JudgmentHistory judgments={record.judgments} />
              </div>
            )}
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
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-sm border border-gray-200">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">交易编号</p>
                <p className="font-mono text-gray-900">{record.tradeId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">当前状态</p>
                <StatusBadge status={record.currentStatus} />
              </div>
            </div>
          </div>

          {record.currentRemark && (
            <div className="bg-gray-50 p-3 rounded-sm border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">当前说明（将作为旧理由留存）</p>
              <p className="text-sm text-gray-500 italic line-through">{record.currentRemark}</p>
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
      </Modal>
    </Layout>
  );
};
