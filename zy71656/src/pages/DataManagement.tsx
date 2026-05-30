import { useEffect, useState } from 'react';
import { Users, BookOpen, FileText, ArrowLeftRight, ScrollText, TrendingUp, Tag } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { PRODUCT_TYPE_LABELS } from '../../shared/types.js';

const tabs = [
  { key: 'authors', label: '作者', icon: Users },
  { key: 'books', label: '图书', icon: BookOpen },
  { key: 'sales', label: '销售', icon: FileText },
  { key: 'returns', label: '退货', icon: ArrowLeftRight },
  { key: 'contracts', label: '合同', icon: ScrollText },
  { key: 'ladders', label: '阶梯', icon: TrendingUp },
  { key: 'discounts', label: '折扣', icon: Tag },
];

export default function DataManagement() {
  const {
    authors,
    books,
    sales,
    returns,
    contracts,
    ladders,
    discounts,
    loadAuthors,
    loadBooks,
    loadSales,
    loadReturns,
    loadContracts,
    loadLadders,
    loadDiscounts,
    selectedPeriod,
    setSelectedPeriod,
  } = useStore();

  const [activeTab, setActiveTab] = useState('authors');

  useEffect(() => {
    switch (activeTab) {
      case 'authors':
        loadAuthors();
        break;
      case 'books':
        loadBooks();
        break;
      case 'sales':
        loadSales(selectedPeriod);
        break;
      case 'returns':
        loadReturns(selectedPeriod);
        break;
      case 'contracts':
        loadContracts();
        break;
      case 'ladders':
        loadLadders();
        break;
      case 'discounts':
        loadDiscounts();
        break;
    }
  }, [
    activeTab,
    selectedPeriod,
    loadAuthors,
    loadBooks,
    loadSales,
    loadReturns,
    loadContracts,
    loadLadders,
    loadDiscounts,
  ]);

  const renderContent = () => {
    switch (activeTab) {
      case 'authors':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">姓名</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">邮箱</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">电话</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {authors.map((author) => (
                <tr key={author.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{author.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{author.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{author.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'books':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">书名</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ISBN</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">作者ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">定价</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">类型</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{book.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{book.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{book.isbn}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{book.authorId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">¥{book.listPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {PRODUCT_TYPE_LABELS[book.productType]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'sales':
        return (
          <div>
            <div className="mb-4">
              <input
                type="month"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ID</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">图书ID</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">渠道</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">销量</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">码洋</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">日期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">{sale.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{sale.bookId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{sale.channel}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{sale.quantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        ¥{sale.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{sale.saleDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'returns':
        return (
          <div>
            <div className="mb-4">
              <input
                type="month"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ID</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">关联销售</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">图书ID</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">数量</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">金额</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">退货日期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {returns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">{ret.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{ret.originalSaleId || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ret.bookId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">{ret.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    ¥{ret.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ret.returnDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'contracts':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">作者ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">图书ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">生效日期</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">失效日期</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{contract.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contract.authorId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contract.bookId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contract.effectiveDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contract.expiryDate || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        contract.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {contract.status === 'ACTIVE' ? '有效' : '无效'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'ladders':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">合同ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">类型</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">起始销量</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">结束销量</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">税率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ladders.map((ladder) => (
                <tr key={ladder.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{ladder.contractId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {PRODUCT_TYPE_LABELS[ladder.productType]}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">{ladder.minVolume}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    {ladder.maxVolume || '∞'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    {(ladder.rate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'discounts':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">名称</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">类型</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">折扣率</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">开始日期</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">结束日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {discounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{discount.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{discount.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {discount.productType ? PRODUCT_TYPE_LABELS[discount.productType] : '通用'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {discount.adjustedRate ? (discount.adjustedRate * 100).toFixed(1) + '%' : '默认'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{discount.startDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{discount.endDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">数据管理</h2>
        <p className="text-gray-500 mt-1">查看和管理系统中的各类数据</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
