import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store';
import { RecordStatus, statusLabels, changeTypeLabels, difficultyOptions } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  ArrowLeft,
  Download,
  MessageSquare,
  Edit3,
  CheckCircle,
  Clock,
  User,
  GitBranch,
  BookOpen,
  AlertCircle,
  Tag,
} from 'lucide-react';

const RecordDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecordById, getChangeLogsByRecordId, addComment, updateDifficulty, updateRecordStatus, exportRecord } = useStore();
  
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [difficultyReason, setDifficultyReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<RecordStatus>('completed');
  const [statusReason, setStatusReason] = useState('');
  const [operator] = useState('教研组长');

  const record = id ? getRecordById(id) : undefined;
  const changeLogs = id ? getChangeLogsByRecordId(id) : [];

  if (!record) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-600 mb-2">记录不存在</h3>
        <Link to="/" className="text-primary-600 hover:text-primary-700">
          返回列表
        </Link>
      </div>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleExport = () => {
    const content = exportRecord(record.id);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `复核报告_${record.questionBankData.questionId}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddComment = () => {
    if (commentText.trim()) {
      addComment(record.id, commentText, operator);
      setCommentText('');
      setShowCommentModal(false);
    }
  };

  const handleUpdateDifficulty = () => {
    if (selectedDifficulty && difficultyReason.trim()) {
      updateDifficulty(record.id, selectedDifficulty, difficultyReason, operator);
      setSelectedDifficulty('');
      setDifficultyReason('');
      setShowDifficultyModal(false);
    }
  };

  const handleUpdateStatus = () => {
    if (statusReason.trim()) {
      updateRecordStatus(record.id, selectedStatus, statusReason, operator);
      setStatusReason('');
      setShowStatusModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-slate-600 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回列表</span>
        </button>
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>导出讲评稿</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-serif mb-2">
                  {record.source}
                </h2>
                <div className="flex items-center space-x-3">
                  <StatusBadge status={record.status} />
                  <span className="text-sm text-slate-500">
                    ID: {record.questionBankData.questionId}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <InfoItem icon={User} label="最后修改人" value={record.reviewer} />
              <InfoItem icon={Clock} label="更新时间" value={formatDate(record.updatedAt)} />
              <InfoItem icon={Tag} label="当前难度" value={record.currentDifficulty} />
              <InfoItem icon={BookOpen} label="知识点" value={record.questionBankData.knowledgePoint} />
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">题目内容</h4>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-lg">
                  {record.questionBankData.questionContent}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">概率树</h4>
                <div className="bg-primary-50 p-4 rounded-lg border border-primary-100">
                  <div className="flex items-center space-x-2 text-primary-700">
                    <GitBranch className="w-4 h-4" />
                    <span className="font-mono text-sm">{record.questionBankData.probabilityTree}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">讲评记录</h4>
                <div className="bg-accent-50 p-4 rounded-lg border border-accent-100">
                  {record.comment ? (
                    <p className="text-accent-800">{record.comment}</p>
                  ) : (
                    <p className="text-accent-500 italic">暂无讲评记录</p>
                  )}
                </div>
              </div>
              {record.pendingReason && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800">待处理原因</h4>
                      <p className="text-amber-700 text-sm mt-1">{record.pendingReason}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold text-slate-800 font-serif mb-6">
              变更历史
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-6">
                {changeLogs.map((log, index) => (
                  <div key={log.id} className="relative pl-10">
                    <div className={`absolute left-2 w-5 h-5 rounded-full border-4 ${
                      log.type === 'difficulty_update' ? 'bg-purple-500 border-purple-200' :
                      log.type === 'comment_add' ? 'bg-blue-500 border-blue-200' :
                      log.type === 'question_bank_edit' ? 'bg-red-500 border-red-200' :
                      'bg-green-500 border-green-200'
                    } shadow-md`} />
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          log.type === 'difficulty_update' ? 'bg-purple-100 text-purple-700' :
                          log.type === 'comment_add' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'question_bank_edit' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {changeTypeLabels[log.type]}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 mb-2">
                        <span className="font-medium">{log.operator}</span>
                        <span className="text-slate-400 mx-2">·</span>
                        <span>修改了 <code className="bg-slate-200 px-1 rounded">{log.field}</code></span>
                      </div>
                      {log.oldValue || log.newValue ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded line-through">
                            {log.oldValue || '(空)'}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                            {log.newValue || '(空)'}
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-2 text-sm text-slate-500">
                        原因：{log.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-slate-800 mb-4">快捷操作</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowCommentModal(true)}
                className="w-full btn-secondary flex items-center justify-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>补充讲评记录</span>
              </button>
              <button
                onClick={() => {
                  setSelectedDifficulty(record.currentDifficulty);
                  setShowDifficultyModal(true);
                }}
                className="w-full btn-secondary flex items-center justify-center space-x-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>修改难度标签</span>
              </button>
              <button
                onClick={() => setShowStatusModal(true)}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>标记处理完成</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-card p-4">
            <h4 className="font-medium text-slate-700 mb-3">难度对比</h4>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">原难度</div>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                  {record.questionBankData.originalDifficulty}
                </span>
              </div>
              <div className="text-slate-300">→</div>
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">现难度</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  record.questionBankData.originalDifficulty !== record.currentDifficulty
                    ? 'bg-accent-100 text-accent-700'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {record.currentDifficulty}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCommentModal && (
        <Modal title="补充讲评记录" onClose={() => setShowCommentModal(false)}>
          <div className="space-y-4">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="请输入讲评记录内容..."
              className="input-field h-32 resize-none"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCommentModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleAddComment}
                className="btn-primary"
              >
                确认提交
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDifficultyModal && (
        <Modal title="修改难度标签" onClose={() => setShowDifficultyModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                选择难度
              </label>
              <div className="flex flex-wrap gap-2">
                {difficultyOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDifficulty(d)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedDifficulty === d
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                修改原因
              </label>
              <textarea
                value={difficultyReason}
                onChange={(e) => setDifficultyReason(e.target.value)}
                placeholder="请说明修改难度的原因..."
                className="input-field h-24 resize-none"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDifficultyModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleUpdateDifficulty}
                className="btn-primary"
                disabled={!selectedDifficulty || !difficultyReason.trim()}
              >
                确认修改
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showStatusModal && (
        <Modal title="更新记录状态" onClose={() => setShowStatusModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                选择状态
              </label>
              <div className="flex flex-wrap gap-2">
                {(['pending', 'completed', 'material_only', 'conclusion_changed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedStatus === s
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                处理说明
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="请说明处理情况..."
                className="input-field h-24 resize-none"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowStatusModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleUpdateStatus}
                className="btn-primary"
                disabled={!statusReason.trim()}
              >
                确认更新
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

interface InfoItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

const InfoItem = ({ icon: Icon, label, value }: InfoItemProps) => (
  <div className="flex items-center space-x-3">
    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary-600" />
    </div>
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-700">{value}</div>
    </div>
  </div>
);

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

const Modal = ({ title, children, onClose }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
      <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>
      {children}
    </div>
  </div>
);

export default RecordDetail;
