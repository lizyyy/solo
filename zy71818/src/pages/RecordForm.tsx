import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { useDepositStore } from '../store/useDepositStore';
import { DepositStatus, ChangeType } from '../types';

export default function RecordForm() {
  const navigate = useNavigate();
  const { addRecord } = useDepositStore();

  const [franchiseeName, setFranchiseeName] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [changeType, setChangeType] = useState<ChangeType>('material');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!franchiseeName.trim()) {
      newErrors.franchiseeName = '请输入加盟商名称';
    }
    if (!amount || Number(amount) <= 0) {
      newErrors.amount = '请输入有效的保证金金额';
    }
    if (!source.trim()) {
      newErrors.source = '请输入来源渠道';
    }
    if (!reason.trim()) {
      newErrors.reason = '请填写操作原因';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const id = addRecord({
      franchiseeName: franchiseeName.trim(),
      amount: Number(amount),
      source: source.trim(),
      status: 'pending_entry' as DepositStatus,
      pendingReason: reason.trim(),
    });

    navigate(`/record/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">新建保证金记录</h1>
              <p className="text-sm text-slate-500">录入加盟商保证金退款信息</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">基本信息</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  加盟商名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={franchiseeName}
                  onChange={(e) => setFranchiseeName(e.target.value)}
                  placeholder="例如：北京朝阳加盟店"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                    errors.franchiseeName ? 'border-red-300' : 'border-slate-300'
                  }`}
                />
                {errors.franchiseeName && (
                  <p className="mt-1 text-sm text-red-600">{errors.franchiseeName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  保证金金额（元） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="例如：50000"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                    errors.amount ? 'border-red-300' : 'border-slate-300'
                  }`}
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  来源渠道 <span className="text-red-500">*</span>
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                    errors.source ? 'border-red-300' : 'border-slate-300'
                  }`}
                >
                  <option value="">请选择来源渠道</option>
                  <option value="华东区域招商部">华东区域招商部</option>
                  <option value="华南区域招商部">华南区域招商部</option>
                  <option value="华北区域招商部">华北区域招商部</option>
                  <option value="西南区域招商部">西南区域招商部</option>
                  <option value="总部直招">总部直招</option>
                </select>
                {errors.source && (
                  <p className="mt-1 text-sm text-red-600">{errors.source}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start mb-4">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">操作记录</h2>
                <p className="text-sm text-slate-500 mt-1">
                  所有操作都会记录在审计日志中，请准确填写操作类型和原因
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  操作类型 <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="changeType"
                      value="material"
                      checked={changeType === 'material'}
                      onChange={() => setChangeType('material')}
                      className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-slate-700">
                      补材料
                      <span className="text-slate-400 ml-1">（仅补充附件）</span>
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="changeType"
                      value="conclusion"
                      checked={changeType === 'conclusion'}
                      onChange={() => setChangeType('conclusion')}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-slate-700">
                      改结论
                      <span className="text-orange-500 ml-1">（实质修改，需复核）</span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  操作原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请详细说明本次操作的原因..."
                  rows={3}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none ${
                    errors.reason ? 'border-red-300' : 'border-slate-300'
                  }`}
                />
                {errors.reason && (
                  <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </Link>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              保存记录
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
