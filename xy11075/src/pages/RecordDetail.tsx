import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Edit2, User, Calendar, MapPin, Monitor, Smartphone } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import PhotoGallery from '../components/PhotoGallery';
import Timeline from '../components/Timeline';
import { 
  DeductionStatus, 
  DeductionAction, 
  canPerformAction, 
  ACTION_LABELS, 
  type DeductionRecord, 
  type StatusHistory 
} from '../../shared/types';

const RecordDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<DeductionRecord | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<DeductionAction | null>(null);
  const [actionRemark, setActionRemark] = useState('');
  const [appealContent, setAppealContent] = useState('');
  const [adjustedScore, setAdjustedScore] = useState('');

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/records/${id}`);
        const data = await res.json();
        setRecord(data);

        const historyRes = await fetch(`/api/records/${id}/history`);
        const historyData = await historyRes.json();
        setHistory(historyData);
      } catch (error) {
        console.error('Failed to fetch record:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id]);

  const handleAction = async () => {
    if (!record || !selectedAction) return;

    try {
      const body: any = {
        action: selectedAction,
        remark: actionRemark,
        operatorId: 'op-001',
        operatorName: '张经理',
        operatorRole: '区域经理',
      };

      if (selectedAction === DeductionAction.APPEAL) {
        body.appealContent = appealContent;
      }

      if (selectedAction === DeductionAction.APPEAL_APPROVE) {
        body.adjustedScore = parseInt(adjustedScore);
        body.adjustRemark = actionRemark;
      }

      const res = await fetch(`/api/records/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setRecord(data.record);
        setHistory([...history, data.history]);
        setShowActionModal(false);
        setSelectedAction(null);
        setActionRemark('');
        setAppealContent('');
        setAdjustedScore('');
      }
    } catch (error) {
      console.error('Failed to perform action:', error);
    }
  };

  const getAvailableActions = (status: DeductionStatus): DeductionAction[] => {
    const actions: DeductionAction[] = [];
    if (canPerformAction(status, DeductionAction.SUBMIT)) actions.push(DeductionAction.SUBMIT);
    if (canPerformAction(status, DeductionAction.APPROVE)) actions.push(DeductionAction.APPROVE);
    if (canPerformAction(status, DeductionAction.REJECT)) actions.push(DeductionAction.REJECT);
    if (canPerformAction(status, DeductionAction.APPEAL)) actions.push(DeductionAction.APPEAL);
    if (canPerformAction(status, DeductionAction.APPEAL_APPROVE)) actions.push(DeductionAction.APPEAL_APPROVE);
    if (canPerformAction(status, DeductionAction.APPEAL_REJECT)) actions.push(DeductionAction.APPEAL_REJECT);
    if (canPerformAction(status, DeductionAction.CLOSE)) actions.push(DeductionAction.CLOSE);
    return actions;
  };

  const getActionButtonStyle = (action: DeductionAction): string => {
    switch (action) {
      case DeductionAction.APPROVE:
      case DeductionAction.CLOSE:
        return 'bg-teal-600 hover:bg-teal-700 text-white';
      case DeductionAction.REJECT:
      case DeductionAction.APPEAL_REJECT:
        return 'bg-red-500 hover:bg-red-600 text-white';
      case DeductionAction.SUBMIT:
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case DeductionAction.APPEAL:
        return 'bg-orange-500 hover:bg-orange-600 text-white';
      case DeductionAction.APPEAL_APPROVE:
        return 'bg-purple-500 hover:bg-purple-600 text-white';
      default:
        return 'bg-gray-500 hover:bg-gray-600 text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  if (!record) {
    return <div className="text-center py-12 text-gray-500">记录不存在</div>;
  }

  const availableActions = getAvailableActions(record.status);
  const hasReusedPhotos = record.details.some(d => d.photos.some(p => p.reusedWarning));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">扣分详情</h1>
            <p className="text-gray-500">记录编号: {record.recordNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {record.status === DeductionStatus.DRAFT && (
            <Link
              to={`/edit/${record.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              编辑
            </Link>
          )}
          {availableActions.map((action) => (
            <button
              key={action}
              onClick={() => {
                setSelectedAction(action);
                setShowActionModal(true);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${getActionButtonStyle(action)}`}
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      </div>

      {hasReusedPhotos && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">检测到照片复用</p>
            <p className="text-sm text-amber-700">本次扣分中有照片曾在其他门店使用，请仔细核查</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">门店名称</label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{record.storeName}</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">巡店日期</label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{record.inspectionDate}</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">巡店督导</label>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{record.inspectorName}</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">提交来源</label>
                <div className="flex items-center gap-2">
                  {record.submissionSource === 'PC' ? (
                    <Monitor className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Smartphone className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium">{record.submissionSource} 端</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">当前状态</label>
                <StatusBadge status={record.status} />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">总扣分</label>
                <span className="text-2xl font-bold text-red-600">-{record.totalScore} 分</span>
                {record.adjustedScore !== undefined && (
                  <span className="ml-2 text-lg text-purple-600">
                    (调整后: -{record.adjustedScore} 分)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">扣分明细</h2>
            <div className="space-y-4">
              {record.details.map((detail, index) => (
                <div key={detail.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">{index + 1}. {detail.itemName}</span>
                    <span className="text-lg font-bold text-red-600">-{detail.score} 分</span>
                  </div>
                  {detail.remark && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-3">{detail.remark}</p>
                  )}
                  <div className="mb-3">
                    <label className="text-sm text-gray-500 mb-2 block">现场照片</label>
                    <PhotoGallery photos={detail.photos} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {record.appealContent && (
            <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6">
              <h2 className="text-lg font-semibold text-orange-800 mb-4">申诉内容</h2>
              <p className="text-gray-700 bg-orange-50 p-4 rounded-lg">{record.appealContent}</p>
              <p className="text-sm text-gray-500 mt-2">申诉时间: {record.appealAt}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">状态流转历史</h2>
            {history.length === 0 ? (
              <p className="text-gray-400 text-sm">暂无历史记录</p>
            ) : (
              <Timeline history={history} />
            )}
          </div>
        </div>
      </div>

      {showActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {ACTION_LABELS[selectedAction!]}
            </h3>

            {selectedAction === DeductionAction.APPEAL && (
              <div className="mb-4">
                <label className="label">申诉理由</label>
                <textarea
                  value={appealContent}
                  onChange={(e) => setAppealContent(e.target.value)}
                  rows={4}
                  className="input"
                  placeholder="请详细描述申诉理由..."
                />
              </div>
            )}

            {selectedAction === DeductionAction.APPEAL_APPROVE && (
              <div className="mb-4">
                <label className="label">调整后扣分</label>
                <input
                  type="number"
                  value={adjustedScore}
                  onChange={(e) => setAdjustedScore(e.target.value)}
                  className="input"
                  placeholder="请输入调整后的扣分数"
                  min={0}
                  max={record.totalScore}
                />
                <p className="text-sm text-gray-500 mt-1">原扣分: {record.totalScore} 分</p>
              </div>
            )}

            <div className="mb-6">
              <label className="label">备注说明</label>
              <textarea
                value={actionRemark}
                onChange={(e) => setActionRemark(e.target.value)}
                rows={3}
                className="input"
                placeholder="请输入备注说明（选填）"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowActionModal(false);
                  setSelectedAction(null);
                  setActionRemark('');
                  setAppealContent('');
                  setAdjustedScore('');
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleAction}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${getActionButtonStyle(selectedAction!)}`}
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordDetail;
