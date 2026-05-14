import { useState, useMemo } from 'react';
import { useInvoiceStore } from './hooks/useInvoiceStore';
import type { InvoiceApplication, Customer } from './types';
import { formatDate, formatCurrency, getStatusLabel, getBlockReasonLabel, validateTaxId } from './utils';

type TabType = 'dashboard' | 'invoices' | 'customers' | 'blocked';

function App() {
  const {
    invoices,
    customers,
    projects,
    currentUser,
    getDashboardStats,
    createInvoice,
    approveInvoice,
    rejectInvoice,
    markAsInvoiced,
    redFlushInvoice,
    reopenInvoice,
    unblockInvoice,
    addCustomer,
    updateCustomer
  } = useInvoiceStore();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceApplication | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<InvoiceApplication>>({});
  const [customerFormData, setCustomerFormData] = useState<Partial<Customer>>({});
  const [remark, setRemark] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [showActionModal, setShowActionModal] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reopenFormData, setReopenFormData] = useState<Partial<InvoiceApplication>>({});

  const stats = getDashboardStats();

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
      const matchesSearch = searchQuery === '' || 
        inv.customerName.includes(searchQuery) ||
        inv.projectName.includes(searchQuery) ||
        (inv.invoiceNumber && inv.invoiceNumber.includes(searchQuery));
      return matchesStatus && matchesSearch;
    });
  }, [invoices, filterStatus, searchQuery]);

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const blockedInvoices = invoices.filter(inv => inv.status === 'blocked');

  const handleCreateInvoice = () => {
    if (formData.customerId && formData.projectId && formData.amount) {
      createInvoice(formData);
      setShowInvoiceForm(false);
      setFormData({});
    }
  };

  const handleCreateCustomer = () => {
    if (customerFormData.name && customerFormData.taxId) {
      if (editingCustomer) {
        updateCustomer(editingCustomer.id, customerFormData);
      } else {
        addCustomer(customerFormData as Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>);
      }
      setShowCustomerForm(false);
      setCustomerFormData({});
      setEditingCustomer(null);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerFormData(customer);
    setShowCustomerForm(true);
  };

  const exportToCSV = () => {
    const headers = ['申请单号', '客户名称', '税号', '项目名称', '项目编码', '金额', '发票类型', '状态', '申请人', '申请时间', '发票号'];
    const rows = invoices.map(inv => [
      inv.id,
      inv.customerName,
      inv.taxId,
      inv.projectName,
      inv.projectCode,
      inv.amount,
      inv.invoiceType === 'special' ? '专票' : '普票',
      getStatusLabel(inv.status),
      inv.applicant,
      formatDate(inv.applyTime),
      inv.invoiceNumber || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `开票申请_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusBadgeClass = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      invoiced: 'bg-blue-100 text-blue-800',
      red_flush: 'bg-orange-100 text-orange-800',
      reopened: 'bg-purple-100 text-purple-800',
      blocked: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">开票抬头复核台</h1>
              <p className="text-sm text-gray-500">当前用户：{currentUser}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                导出CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            {[
              { key: 'dashboard', label: '仪表盘', icon: '📊' },
              { key: 'invoices', label: '开票申请', icon: '📄', count: pendingInvoices.length },
              { key: 'blocked', label: '拦截记录', icon: '🚫', count: blockedInvoices.length },
              { key: 'customers', label: '客户管理', icon: '👥' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon} {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">待处理</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">已完成</p>
                    <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                  </div>
                  <div className="text-4xl">✅</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">被拦截</p>
                    <p className="text-3xl font-bold text-gray-600">{stats.blocked}</p>
                  </div>
                  <div className="text-4xl">🚫</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">总申请</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                  </div>
                  <div className="text-4xl">📊</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">最近申请</h2>
              </div>
              <div className="divide-y">
                {invoices.slice(0, 5).map(invoice => (
                  <div key={invoice.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedInvoice(invoice)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{invoice.customerName}</p>
                        <p className="text-sm text-gray-500">{invoice.projectName} · {formatCurrency(invoice.amount)}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="搜索客户、项目或发票号..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 border rounded-lg w-64 text-sm"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待复核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已驳回</option>
                  <option value="invoiced">已开票</option>
                  <option value="red_flush">已红冲</option>
                  <option value="reopened">已重开</option>
                </select>
              </div>
              <button
                onClick={() => {
                  setFormData({});
                  setShowInvoiceForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                + 新建开票申请
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请人</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{invoice.customerName}</div>
                        <div className="text-xs text-gray-500">{invoice.taxId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{invoice.projectName}</div>
                        <div className="text-xs text-gray-500">{invoice.projectCode}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(invoice.amount)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{invoice.invoiceType === 'special' ? '专票' : '普票'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(invoice.status)}`}>
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{invoice.applicant}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button onClick={() => setSelectedInvoice(invoice)} className="text-blue-600 hover:text-blue-800">查看</button>
                        {invoice.status === 'pending' && (
                          <>
                            <button onClick={() => { setSelectedInvoice(invoice); setShowActionModal('approve'); }} className="text-green-600 hover:text-green-800">通过</button>
                            <button onClick={() => { setSelectedInvoice(invoice); setShowActionModal('reject'); }} className="text-red-600 hover:text-red-800">驳回</button>
                          </>
                        )}
                        {invoice.status === 'approved' && (
                          <button onClick={() => { setSelectedInvoice(invoice); setShowActionModal('invoice'); }} className="text-blue-600 hover:text-blue-800">开票</button>
                        )}
                        {invoice.status === 'invoiced' && (
                          <button onClick={() => { setSelectedInvoice(invoice); setShowActionModal('redflush'); }} className="text-orange-600 hover:text-orange-800">红冲</button>
                        )}
                        {invoice.status === 'red_flush' && !invoice.isReopened && (
                          <button onClick={() => { 
                        setSelectedInvoice(invoice); 
                        setReopenFormData({
                          customerId: invoice.customerId,
                          customerName: invoice.customerName,
                          taxId: invoice.taxId,
                          address: invoice.address,
                          phone: invoice.phone,
                          bankName: invoice.bankName,
                          bankAccount: invoice.bankAccount,
                          amount: invoice.amount,
                          invoiceType: invoice.invoiceType
                        });
                        setShowActionModal('reopen'); 
                      }} className="text-purple-600 hover:text-purple-800">重开</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'blocked' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">拦截记录</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">拦截原因</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">拦截信息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blockedInvoices.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{invoice.customerName}</div>
                        <div className="text-xs text-gray-500">{invoice.taxId}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{invoice.projectName}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          {invoice.blockReason && getBlockReasonLabel(invoice.blockReason)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{invoice.blockMessage}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button onClick={() => setSelectedInvoice(invoice)} className="text-blue-600 hover:text-blue-800">查看</button>
                        <button onClick={() => { if (unblockInvoice(invoice.id)) { alert('已解除拦截'); } }} className="text-green-600 hover:text-green-800">解除拦截</button>
                      </td>
                    </tr>
                  ))}
                  {blockedInvoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">暂无拦截记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">客户抬头管理</h2>
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setCustomerFormData({});
                  setShowCustomerForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                + 新增客户
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">税号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址/电话</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">银行信息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map(customer => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.name}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-mono">{customer.taxId}</div>
                        <div className={`text-xs ${validateTaxId(customer.taxId) ? 'text-green-600' : 'text-red-600'}`}>
                          {validateTaxId(customer.taxId) ? '✓ 格式正确' : '✗ 格式异常'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {customer.address && <div>{customer.address}</div>}
                        {customer.phone && <div>{customer.phone}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {customer.bankName && <div>{customer.bankName}</div>}
                        {customer.bankAccount && <div>{customer.bankAccount}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button onClick={() => handleEditCustomer(customer)} className="text-blue-600 hover:text-blue-800">编辑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showInvoiceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">新建开票申请</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择客户</label>
                <select
                  value={formData.customerId || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    if (customer) {
                      setFormData({
                        ...formData,
                        customerId: customer.id,
                        customerName: customer.name,
                        taxId: customer.taxId,
                        address: customer.address,
                        phone: customer.phone,
                        bankName: customer.bankName,
                        bankAccount: customer.bankAccount
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">请选择客户</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择项目</label>
                <select
                  value={formData.projectId || ''}
                  onChange={(e) => {
                    const project = projects.find(p => p.id === e.target.value);
                    if (project) {
                      setFormData({
                        ...formData,
                        projectId: project.id,
                        projectName: project.name,
                        projectCode: project.code
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">请选择项目</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开票金额</label>
                <input
                  type="number"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="请输入金额"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">发票类型</label>
                <select
                  value={formData.invoiceType || 'special'}
                  onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value as 'special' | 'normal' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="special">增值税专用发票</option>
                  <option value="normal">增值税普通发票</option>
                </select>
              </div>
              {formData.customerName && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">开票信息预览</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>名称：</strong>{formData.customerName}</p>
                    <p><strong>税号：</strong>{formData.taxId}</p>
                    {formData.address && <p><strong>地址：</strong>{formData.address}</p>}
                    {formData.phone && <p><strong>电话：</strong>{formData.phone}</p>}
                    {formData.bankName && <p><strong>开户行：</strong>{formData.bankName}</p>}
                    {formData.bankAccount && <p><strong>账号：</strong>{formData.bankAccount}</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowInvoiceForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleCreateInvoice} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">提交申请</button>
            </div>
          </div>
        </div>
      )}

      {showCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{editingCustomer ? '编辑客户' : '新增客户'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客户名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={customerFormData.name || ''}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="请输入客户名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">税号 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={customerFormData.taxId || ''}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, taxId: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg font-mono ${
                    customerFormData.taxId && !validateTaxId(customerFormData.taxId) ? 'border-red-300' : ''
                  }`}
                  placeholder="请输入15-20位字母数字税号"
                />
                {customerFormData.taxId && !validateTaxId(customerFormData.taxId) && (
                  <p className="text-xs text-red-500 mt-1">税号格式不正确，请输入15-20位字母数字</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                <input
                  type="text"
                  value={customerFormData.address || ''}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="请输入地址"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
                <input
                  type="text"
                  value={customerFormData.phone || ''}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="请输入电话"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开户银行</label>
                <input
                  type="text"
                  value={customerFormData.bankName || ''}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="请输入开户银行"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">银行账号</label>
                <input
                  type="text"
                  value={customerFormData.bankAccount || ''}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, bankAccount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                  placeholder="请输入银行账号"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCustomerForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleCreateCustomer} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">开票申请详情</h3>
              <button onClick={() => { setSelectedInvoice(null); setShowActionModal(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{selectedInvoice.customerName}</h4>
                  <p className="text-sm text-gray-500 font-mono">{selectedInvoice.taxId}</p>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClass(selectedInvoice.status)}`}>
                  {getStatusLabel(selectedInvoice.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">项目信息</h5>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p className="text-sm"><strong>项目名称：</strong>{selectedInvoice.projectName}</p>
                    <p className="text-sm"><strong>项目编码：</strong>{selectedInvoice.projectCode}</p>
                    <p className="text-sm"><strong>开票金额：</strong>{formatCurrency(selectedInvoice.amount)}</p>
                    <p className="text-sm"><strong>发票类型：</strong>{selectedInvoice.invoiceType === 'special' ? '增值税专用发票' : '增值税普通发票'}</p>
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-2">申请信息</h5>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p className="text-sm"><strong>申请人：</strong>{selectedInvoice.applicant}</p>
                    <p className="text-sm"><strong>申请时间：</strong>{formatDate(selectedInvoice.applyTime)}</p>
                    {selectedInvoice.reviewer && <p className="text-sm"><strong>审核人：</strong>{selectedInvoice.reviewer}</p>}
                    {selectedInvoice.reviewTime && <p className="text-sm"><strong>审核时间：</strong>{formatDate(selectedInvoice.reviewTime)}</p>}
                    {selectedInvoice.invoiceNumber && <p className="text-sm"><strong>发票号：</strong>{selectedInvoice.invoiceNumber}</p>}
                    {selectedInvoice.invoiceTime && <p className="text-sm"><strong>开票时间：</strong>{formatDate(selectedInvoice.invoiceTime)}</p>}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-sm font-medium text-gray-500 mb-2">开票信息</h5>
                <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm"><strong>名称：</strong>{selectedInvoice.customerName}</p>
                  <p className="text-sm font-mono"><strong>税号：</strong>{selectedInvoice.taxId}</p>
                  {selectedInvoice.address && <p className="text-sm"><strong>地址：</strong>{selectedInvoice.address}</p>}
                  {selectedInvoice.phone && <p className="text-sm"><strong>电话：</strong>{selectedInvoice.phone}</p>}
                  {selectedInvoice.bankName && <p className="text-sm"><strong>开户行：</strong>{selectedInvoice.bankName}</p>}
                  {selectedInvoice.bankAccount && <p className="text-sm font-mono"><strong>账号：</strong>{selectedInvoice.bankAccount}</p>}
                </div>
              </div>

              {selectedInvoice.blockReason && (
                <div className="mb-6">
                  <h5 className="text-sm font-medium text-red-600 mb-2">⚠️ 拦截信息</h5>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-red-800">{getBlockReasonLabel(selectedInvoice.blockReason)}</p>
                    <p className="text-sm text-red-600 mt-1">{selectedInvoice.blockMessage}</p>
                  </div>
                </div>
              )}

              {selectedInvoice.originalInvoiceId && (
                <div className="mb-6">
                  <h5 className="text-sm font-medium text-purple-600 mb-2">🔄 重开差异对比</h5>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm font-medium text-purple-800 mb-3">
                      此发票由原发票重开，原发票号：{invoices.find(i => i.id === selectedInvoice.originalInvoiceId)?.invoiceNumber || selectedInvoice.originalInvoiceId}
                    </p>
                    <div className="space-y-2">
                      {(() => {
                        const originalInvoice = invoices.find(i => i.id === selectedInvoice.originalInvoiceId);
                        if (!originalInvoice) return null;
                        const fields = [
                          { label: '客户名称', newVal: selectedInvoice.customerName, oldVal: originalInvoice.customerName },
                          { label: '税号', newVal: selectedInvoice.taxId, oldVal: originalInvoice.taxId },
                          { label: '开票金额', newVal: formatCurrency(selectedInvoice.amount), oldVal: formatCurrency(originalInvoice.amount) }
                        ];
                        return fields
                          .filter(f => f.newVal !== f.oldVal)
                          .map((field, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <span className="text-gray-600 w-20">{field.label}:</span>
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded line-through">{field.oldVal}</span>
                              <span className="text-gray-400">→</span>
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{field.newVal}</span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h5 className="text-sm font-medium text-gray-500 mb-2">操作日志</h5>
                <div className="space-y-3">
                  {selectedInvoice.operationLogs.map((log, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                          {log.operator[0]}
                        </div>
                        {index < selectedInvoice.operationLogs.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{log.operator}</p>
                            <p className="text-sm text-gray-600">{log.operation}</p>
                            {log.remark && <p className="text-sm text-gray-500 mt-1">备注：{log.remark}</p>}
                            {log.oldValue && log.newValue && (
                              <div className="mt-2 flex gap-3 text-xs">
                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded">- {log.oldValue}</span>
                                <span className="text-gray-400">→</span>
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">+ {log.newValue}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{formatDate(log.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!showActionModal && (
              <div className="p-6 border-t flex justify-end gap-3">
                {selectedInvoice.status === 'pending' && (
                  <>
                    <button onClick={() => setShowActionModal('approve')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">审核通过</button>
                    <button onClick={() => setShowActionModal('reject')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">驳回申请</button>
                  </>
                )}
                {selectedInvoice.status === 'approved' && (
                  <button onClick={() => setShowActionModal('invoice')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认开票</button>
                )}
                {selectedInvoice.status === 'invoiced' && (
                  <button onClick={() => setShowActionModal('redflush')} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">红冲发票</button>
                )}
                {selectedInvoice.status === 'red_flush' && !selectedInvoice.isReopened && (
                  <button onClick={() => setShowActionModal('reopen')} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">重开发票</button>
                )}
                <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">关闭</button>
              </div>
            )}

            {showActionModal && (
              <div className="p-6 border-t bg-gray-50">
                {showActionModal === 'approve' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">确认审核通过？</h4>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="填写审核意见（可选）"
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowActionModal(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">取消</button>
                      <button onClick={() => { approveInvoice(selectedInvoice.id, remark); setSelectedInvoice(null); setShowActionModal(null); setRemark(''); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">确认通过</button>
                    </div>
                  </div>
                )}

                {showActionModal === 'reject' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">驳回申请</h4>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="填写驳回原因（必填）"
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowActionModal(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">取消</button>
                      <button onClick={() => { if (remark) { rejectInvoice(selectedInvoice.id, remark); setSelectedInvoice(null); setShowActionModal(null); setRemark(''); } }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">确认驳回</button>
                    </div>
                  </div>
                )}

                {showActionModal === 'invoice' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">确认开票</h4>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="请输入发票号码"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowActionModal(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">取消</button>
                      <button onClick={() => { if (invoiceNumber) { markAsInvoiced(selectedInvoice.id, invoiceNumber); setSelectedInvoice(null); setShowActionModal(null); setInvoiceNumber(''); } }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认开票</button>
                    </div>
                  </div>
                )}

                {showActionModal === 'redflush' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">确认红冲发票？</h4>
                    <p className="text-sm text-gray-500">发票号：{selectedInvoice.invoiceNumber}</p>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="填写红冲原因（可选）"
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowActionModal(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">取消</button>
                      <button onClick={() => { redFlushInvoice(selectedInvoice.id, remark); setSelectedInvoice(null); setShowActionModal(null); setRemark(''); }} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">确认红冲</button>
                    </div>
                  </div>
                )}

                {showActionModal === 'reopen' && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">重开发票 - 修改抬头信息</h4>
                    <p className="text-sm text-gray-500">原发票号：{selectedInvoice.invoiceNumber} - 请修改新发票的客户抬头信息</p>
                    
                    <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">客户名称</label>
                        <input
                          type="text"
                          value={reopenFormData.customerName || ''}
                          onChange={(e) => setReopenFormData({ ...reopenFormData, customerName: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="请输入客户名称"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">税号</label>
                        <input
                          type="text"
                          value={reopenFormData.taxId || ''}
                          onChange={(e) => setReopenFormData({ ...reopenFormData, taxId: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg font-mono ${
                            reopenFormData.taxId && !validateTaxId(reopenFormData.taxId) ? 'border-red-300' : ''
                          }`}
                          placeholder="请输入15-20位字母数字税号"
                        />
                        {reopenFormData.taxId && !validateTaxId(reopenFormData.taxId) && (
                          <p className="text-xs text-red-500 mt-1">税号格式不正确</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                          <input
                            type="text"
                            value={reopenFormData.address || ''}
                            onChange={(e) => setReopenFormData({ ...reopenFormData, address: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="请输入地址"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
                          <input
                            type="text"
                            value={reopenFormData.phone || ''}
                            onChange={(e) => setReopenFormData({ ...reopenFormData, phone: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="请输入电话"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">开户银行</label>
                        <input
                          type="text"
                          value={reopenFormData.bankName || ''}
                          onChange={(e) => setReopenFormData({ ...reopenFormData, bankName: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="请输入开户银行"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">银行账号</label>
                        <input
                          type="text"
                          value={reopenFormData.bankAccount || ''}
                          onChange={(e) => setReopenFormData({ ...reopenFormData, bankAccount: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg font-mono"
                          placeholder="请输入银行账号"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">开票金额</label>
                          <input
                            type="number"
                            value={reopenFormData.amount || ''}
                            onChange={(e) => setReopenFormData({ ...reopenFormData, amount: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="请输入金额"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">发票类型</label>
                          <select
                            value={reopenFormData.invoiceType || 'special'}
                            onChange={(e) => setReopenFormData({ ...reopenFormData, invoiceType: e.target.value as 'special' | 'normal' })}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="special">增值税专用发票</option>
                            <option value="normal">增值税普通发票</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setShowActionModal(null); setReopenFormData({}); }} className="px-4 py-2 border rounded-lg hover:bg-gray-100">取消</button>
                      <button onClick={() => { 
                        reopenInvoice(selectedInvoice.id, reopenFormData); 
                        setSelectedInvoice(null); 
                        setShowActionModal(null); 
                        setReopenFormData({});
                      }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">确认重开</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
