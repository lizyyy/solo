import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVoucherStore } from '../store/voucherStore';
import { formatStatus, formatMoney, formatDate } from '../components/Layout';
import { Receipt, Plus, Search, Filter, Eye, AlertTriangle } from 'lucide-react';

export default function VoucherList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { vouchers, summary, fetchVouchers, createVoucher, loading, error, clearError } = useVoucherStore();
  const [showUpload, setShowUpload] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    amount: '',
    date: '',
    description: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const statusFilter = searchParams.get('status') || '';
  const customerFilter = searchParams.get('customer') || '';

  useEffect(() => {
    fetchVouchers({
      status: statusFilter || undefined,
      customer: customerFilter || undefined,
    });
  }, [fetchVouchers, statusFilter, customerFilter]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const fd = new FormData();
    fd.append('customerName', formData.customerName);
    fd.append('amount', formData.amount);
    fd.append('date', formData.date);
    fd.append('description', formData.description);
    fd.append('uploadedBy', '张会计');
    fd.append('file', file);

    const result = await createVoucher(fd);
    if (result) {
      setShowUpload(false);
      setFormData({ customerName: '', amount: '', date: '', description: '' });
      setFile(null);
      await fetchVouchers();
    }
  };

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'pending', label: '待处理' },
    { value: 'parsing', label: '解析中' },
    { value: 'reviewing', label: '待审核' },
    { value: 'revised', label: '已修订' },
    { value: 'completed', label: '已完成' },
    { value: 'exception', label: '异常' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">凭证管理</h2>
          <p className="text-gray-500 text-sm mt-1">共 {summary.total} 张凭证，{summary.exception} 张异常待处理</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          上传凭证
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
          <button onClick={clearError} className="text-sm hover:underline">关闭</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索客户名称..."
              value={customerFilter}
              onChange={(e) => handleFilterChange('customer', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">上传新凭证</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客户名称 *</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金额 *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">票据照片 *</label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '上传中...' : '上传并解析'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">凭证号</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">摘要</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">加载中...</td>
              </tr>
            ) : vouchers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">暂无凭证数据</td>
              </tr>
            ) : (
              vouchers.map(v => {
                const status = formatStatus(v.status);
                const isException = v.status === 'exception';
                return (
                  <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${isException ? 'bg-red-50/50' : ''}`}>
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm text-gray-700">{v.voucherNo}</span>
                      {isException && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                          <AlertTriangle size={12} />
                          票据模糊
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-medium text-gray-900">{v.customerName}</span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 text-sm max-w-xs truncate">
                      {v.description || '待识别'}
                    </td>
                    <td className="px-5 py-4 text-gray-600 text-sm">{formatDate(v.date)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      {formatMoney(v.amount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${status.class}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Link
                        to={`/vouchers/${v.id}`}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm"
                      >
                        <Eye size={14} />
                        详情
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
