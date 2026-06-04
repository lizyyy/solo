import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  AlertTriangle,
  Cpu,
  Tag,
  User,
  Clock,
  Box,
  FileText,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import HistoryTimeline from '../components/HistoryTimeline';
import WorkflowProgress from '../components/WorkflowProgress';
import { cn } from '../lib/utils';

const ThresholdDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    thresholds,
    getDeviceById,
    getThresholdHistory,
    updateThreshold,
    currentRole,
    getReportByThresholdId,
  } = useThresholdStore();

  const threshold = thresholds.find((t) => t.id === id);
  const device = threshold ? getDeviceById(threshold.deviceId) : undefined;
  const history = id ? getThresholdHistory(id) : [];
  const report = id ? getReportByThresholdId(id) : undefined;

  const [isEditing, setIsEditing] = useState(false);
  const [editRemark, setEditRemark] = useState(threshold?.remark || '');
  const [editReason, setEditReason] = useState('');

  if (!threshold) {
    return (
      <div className="text-center py-16">
        <p className="text-industrial-300 text-lg">未找到该阈值数据</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary-400 hover:text-primary-300"
        >
          返回列表
        </button>
      </div>
    );
  }

  const handleSave = () => {
    if (id) {
      updateThreshold(id, { remark: editRemark }, editReason || '修改备注');
      setIsEditing(false);
      setEditReason('');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatUnit = (unit: string) => {
    return unit === 'Celsius' ? '℃' : 'K';
  };

  const currentStep = threshold.status === 'approved' ? 'report' :
    threshold.status === 'reviewing' ? 'coach_review' : 'engineer_review';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-industrial-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回列表
        </button>
        <div className="h-6 w-px bg-industrial-500" />
        <h1 className="text-2xl font-bold text-white">阈值详情</h1>
        {threshold.hasUnitMix && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-warning-500/20 text-warning-400 border border-warning-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            单位混用 - 待复核
          </span>
        )}
      </div>

      <WorkflowProgress currentStep={currentStep as any} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">基本信息</h2>
              {!isEditing && currentRole === 'engineer' && (
                <button
                  onClick={() => {
                    setEditRemark(threshold.remark);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300 text-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  编辑备注
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">阈值名称</label>
                <p className="text-white font-medium">{threshold.name}</p>
              </div>
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">阈值数值</label>
                <p className="text-white font-mono text-xl">
                  {threshold.value}
                  <span className="text-industrial-300 text-lg ml-1">
                    {formatUnit(threshold.unit)}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">关联设备</label>
                <p className="text-white">{device?.name || '-'}</p>
                <p className="text-industrial-400 text-sm">{device?.model || '-'}</p>
              </div>
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">当前状态</label>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                  threshold.status === 'approved' ? "bg-success-500/20 text-success-400 border-success-500/30" :
                  threshold.status === 'reviewing' ? "bg-primary-500/20 text-primary-400 border-primary-500/30" :
                  "bg-warning-500/20 text-warning-400 border-warning-500/30"
                )}>
                  {threshold.status === 'approved' ? '已通过' :
                   threshold.status === 'reviewing' ? '复核中' : '待处理'}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-industrial-500">
              <label className="text-industrial-400 text-sm block mb-1.5">备注信息</label>
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                    rows={3}
                    placeholder="输入备注信息..."
                  />
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
                    placeholder="修改原因（可选）"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-industrial-700 hover:bg-industrial-500 text-industrial-300 rounded-lg text-sm"
                    >
                      <X className="w-4 h-4" />
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-white">{threshold.remark}</p>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-industrial-500 grid grid-cols-2 gap-6">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-industrial-400" />
                <span className="text-industrial-400">创建人：</span>
                <span className="text-white">{threshold.createdBy}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-industrial-400" />
                <span className="text-industrial-400">更新时间：</span>
                <span className="text-white">{formatDate(threshold.updatedAt)}</span>
              </div>
            </div>
          </div>

          {threshold.calculationModel && (
            <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-primary-400" />
                <h2 className="text-lg font-semibold text-white">计算模型</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-industrial-400 text-sm block mb-1.5">模型名称</label>
                  <p className="text-white font-mono">{threshold.calculationModel}</p>
                </div>
                <div>
                  <label className="text-industrial-400 text-sm block mb-1.5">版本号</label>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-success-400" />
                    <span className="text-white font-mono">{threshold.modelVersion}</span>
                  </div>
                </div>
              </div>
              {threshold.tradeOffReason && (
                <div className="mt-4 pt-4 border-t border-industrial-500">
                  <label className="text-industrial-400 text-sm block mb-1.5">取舍理由</label>
                  <p className="text-white bg-industrial-700/50 rounded-lg p-3">
                    {threshold.tradeOffReason}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">历史变更记录</h2>
            <HistoryTimeline records={history} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Box className="w-5 h-5 text-primary-400" />
              <h3 className="text-white font-semibold">设备铭牌参数</h3>
            </div>
            {device ? (
              <div className="space-y-4">
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">设备名称</p>
                  <p className="text-white font-medium">{device.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-industrial-700/50 rounded-lg p-3">
                    <p className="text-industrial-400 text-xs mb-1">型号</p>
                    <p className="text-white text-sm">{device.model}</p>
                  </div>
                  <div className="bg-industrial-700/50 rounded-lg p-3">
                    <p className="text-industrial-400 text-xs mb-1">制造商</p>
                    <p className="text-white text-sm">{device.manufacturer}</p>
                  </div>
                </div>
                <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/30">
                  <p className="text-primary-400 text-xs mb-1">额定温度</p>
                  <p className="text-white font-mono text-xl">
                    {device.nameplateParams.ratedTemperature}
                    <span className="text-industrial-300 text-lg ml-1">
                      {formatUnit(device.nameplateParams.temperatureUnit)}
                    </span>
                  </p>
                  <p className="text-industrial-400 text-xs mt-1">
                    序列号：{device.nameplateParams.serialNumber}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-industrial-400 text-sm">暂无设备信息</p>
            )}
          </div>

          {report && (
            <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-success-400" />
                <h3 className="text-white font-semibold">交接报告</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-industrial-400 text-xs mb-1">内容摘要</p>
                  <p className="text-white text-sm">{report.content}</p>
                </div>
                <div>
                  <p className="text-industrial-400 text-xs mb-1">留存原因</p>
                  <p className="text-white text-sm">{report.retentionReason}</p>
                </div>
                {report.missingMaterials.length > 0 && (
                  <div>
                    <p className="text-industrial-400 text-xs mb-2">缺少材料</p>
                    <ul className="space-y-1">
                      {report.missingMaterials.map((m, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-warning-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="pt-3 border-t border-industrial-500">
                  <p className="text-industrial-400 text-xs mb-1">下一步行动</p>
                  <p className="text-white text-sm">{report.nextAction}</p>
                  <p className="text-primary-400 text-xs mt-1">
                    对接人：{report.assigneeRole === 'engineer' ? '设备工程师 何工' : '训练教练'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <h3 className="text-white font-semibold mb-4">快捷操作</h3>
            <div className="space-y-2">
              <Link
                to={`/visualization?highlight=${threshold.id}`}
                className="flex items-center gap-2 w-full px-4 py-3 bg-industrial-700 hover:bg-industrial-500 text-white rounded-lg transition-colors"
              >
                <Box className="w-4 h-4" />
                查看 3D 可视化
              </Link>
              <Link
                to="/workflow"
                className="flex items-center gap-2 w-full px-4 py-3 bg-industrial-700 hover:bg-industrial-500 text-white rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                查看工作流
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThresholdDetail;
