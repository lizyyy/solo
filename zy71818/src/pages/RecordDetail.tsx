import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Upload,
  FileText,
  Paperclip,
  Clock,
  History,
  AlertCircle,
  X,
} from 'lucide-react';
import { useDepositStore } from '../store/useDepositStore';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';
import AuditLogList from '../components/AuditLogList';
import { MATERIAL_TYPE_LABELS, MaterialType, ChangeType } from '../types';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getRecordById,
    getMaterialsByRecordId,
    getAuditLogsByRecordId,
    getStatusHistoryByRecordId,
    exportRecord,
    addMaterial,
  } = useDepositStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<MaterialType>('refund_list');
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'audit'>('timeline');

  const record = id ? getRecordById(id) : undefined;
  const materials = id ? getMaterialsByRecordId(id) : [];
  const auditLogs = id ? getAuditLogsByRecordId(id) : [];
  const statusHistory = id ? getStatusHistoryByRecordId(id) : [];

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">记录不存在</p>
          <Link
            to="/"
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const formatMoney = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN')}`;
  };

  const handleExport = () => {
    const content = exportRecord(record.id);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `保证金对账说明-${record.franchiseeName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    if (!uploadName.trim()) return;

    addMaterial({
      recordId: record.id,
      type: uploadType,
      name: uploadName,
      uploader: '当前用户',
      description: uploadDescription,
    });

    setShowUploadModal(false);
    setUploadName('');
    setUploadDescription('');
  };

  const getMaterialIcon = (type: MaterialType) => {
    switch (type) {
      case 'refund_list':
        return '📋';
      case 'settlement':
        return '📑';
      case 'statement':
        return '📊';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {record.franchiseeName}
                </h1>
                <p className="text-sm text-slate-500">
                  保证金退款记录详情
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                上传材料
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center px-3 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                导出对账说明
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                基本信息
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">加盟商名称</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {record.franchiseeName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">保证金金额</p>
                  <p className="mt-1 font-semibold text-slate-900 text-lg">
                    {formatMoney(record.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">来源渠道</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {record.source}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">当前状态</p>
                  <div className="mt-1">
                    <StatusBadge status={record.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">创建时间</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatDate(record.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">更新时间</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatDate(record.updatedAt)}
                  </p>
                </div>
              </div>

              {record.pendingReason && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        待处理原因
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        {record.pendingReason}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="border-b border-slate-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'timeline'
                        ? 'border-slate-800 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Clock className="w-4 h-4 inline mr-2" />
                    状态时间线
                  </button>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'audit'
                        ? 'border-slate-800 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <History className="w-4 h-4 inline mr-2" />
                    操作审计记录
                  </button>
                </div>
              </div>
              <div className="p-6">
                {activeTab === 'timeline' ? (
                  <Timeline history={statusHistory} />
                ) : (
                  <div>
                    <p className="text-sm text-slate-500 mb-4">
                      <span className="inline-block w-3 h-3 bg-orange-100 border border-orange-300 rounded mr-2"></span>
                      橙色标记为【改结论】- 实质修改，影响审核结果
                      <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 rounded ml-4 mr-2"></span>
                      灰色标记为【补材料】- 仅补充附件，不改结论
                    </p>
                    <AuditLogList logs={auditLogs} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  材料附件
                </h2>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  <Paperclip className="w-4 h-4 inline mr-1" />
                  添加
                </button>
              </div>
              {materials.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  暂无材料附件
                </p>
              ) : (
                <div className="space-y-3">
                  {materials.map((material) => (
                    <div
                      key={material.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">
                          {getMaterialIcon(material.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {material.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {MATERIAL_TYPE_LABELS[material.type]}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {material.uploader} ·{' '}
                            {formatDate(material.uploadedAt)}
                          </p>
                          {material.description && (
                            <p className="text-xs text-slate-500 mt-2 bg-white p-2 rounded">
                              {material.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-100 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">
                快速操作提示
              </h3>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• 上传退款清单后自动进入"待结算附件"</li>
                <li>• 上传结算附件后自动进入下一状态</li>
                <li>• 修改对账单金额需标注"改结论"并说明原因</li>
                <li>• 导出的对账说明可直接发给下一班同事</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                上传材料
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  材料类型
                </label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as MaterialType)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="refund_list">退款清单</option>
                  <option value="settlement">结算附件</option>
                  <option value="statement">对账单</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  文件名称
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="例如：退款清单-北京朝阳.xlsx"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  备注说明
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="简要说明这份材料的内容..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认上传
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
