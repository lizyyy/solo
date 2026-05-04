import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import {
  importProducts,
  importTransactions,
  importSubscriptions,
  importPayoutRules
} from '../services/api';
import { formatFileSize } from '../utils/format';

function Import() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('products');
  const [importResults, setImportResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const importMutation = useMutation(
    ({ type, file }) => {
      switch (type) {
        case 'products': return importProducts(file);
        case 'transactions': return importTransactions(file);
        case 'subscriptions': return importSubscriptions(file);
        case 'payout-rules': return importPayoutRules(file);
        default: throw new Error('Unknown import type');
      }
    },
    {
      onSuccess: (data) => {
        setImportResults(data.data);
        queryClient.invalidateQueries('products');
        queryClient.invalidateQueries('transactions');
        queryClient.invalidateQueries('subscriptions');
        queryClient.invalidateQueries('holders');
        queryClient.invalidateQueries('accounts');
      },
    }
  );

  const tabs = [
    { id: 'products', label: '产品数据', icon: '📦', format: 'CSV', description: '导入 products.csv，包含理财产品信息' },
    { id: 'transactions', label: '交易流水', icon: '📄', format: 'CSV', description: '导入 transactions.csv，包含银行流水记录' },
    { id: 'subscriptions', label: '认购份额', icon: '📊', format: 'CSV', description: '导入 subscriptions.csv，包含持有人认购份额' },
    { id: 'payout-rules', label: '收益规则', icon: '⚙️', format: 'JSON', description: '导入 payout-rules.json，包含收益计算规则' },
  ];

  const currentTab = tabs.find(t => t.id === activeTab);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      importMutation.mutate({ type: activeTab, file });
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      importMutation.mutate({ type: activeTab, file });
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据导入</h1>
        <p className="text-gray-500 mt-1">导入 CSV 或 JSON 格式的数据文件</p>
      </div>

      <div className="card">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setImportResults(null);
              }}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{currentTab?.label}</h2>
            <p className="text-gray-500 mt-1">{currentTab?.description}</p>
            <p className="text-sm text-gray-400 mt-1">支持格式: {currentTab?.format}</p>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragOver
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {importMutation.isLoading ? (
              <div>
                <p className="text-4xl mb-3">⏳</p>
                <p className="text-gray-600">正在导入数据...</p>
              </div>
            ) : (
              <>
                <p className="text-4xl mb-3">📥</p>
                <p className="text-gray-600 mb-4">
                  拖拽文件到这里，或
                  <label className="text-primary-600 hover:text-primary-800 cursor-pointer ml-1">
                    点击选择文件
                    <input
                      type="file"
                      accept={currentTab?.format === 'JSON' ? '.json' : '.csv'}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-400">
                  支持 {currentTab?.format} 格式
                </p>
              </>
            )}
          </div>

          {importMutation.error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">导入失败</h3>
              <p className="text-sm text-red-700">
                {importMutation.error?.response?.data?.error || importMutation.error?.message || '未知错误'}
              </p>
              {importMutation.error?.response?.data?.details && (
                <div className="mt-2 text-sm text-red-600">
                  {importMutation.error.response.data.details.map((detail, idx) => (
                    <p key={idx}>• 第 {detail.row} 行: {detail.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {importResults && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800 mb-3">导入成功</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-green-600">新增记录</p>
                  <p className="text-2xl font-bold text-green-700">
                    {importResults.createdCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">更新记录</p>
                  <p className="text-2xl font-bold text-green-700">
                    {importResults.updatedCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">跳过记录</p>
                  <p className="text-2xl font-bold text-green-700">
                    {importResults.skippedCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">处理记录</p>
                  <p className="text-2xl font-bold text-green-700">
                    {importResults.totalProcessed || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">数据格式说明</h2>
        
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">products.csv 格式</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">字段</th>
                    <th className="py-2">类型</th>
                    <th className="py-2">必填</th>
                    <th className="py-2">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2 font-mono">product_code</td><td className="py-2">字符串</td><td className="py-2">是</td><td className="py-2">产品代码，唯一标识</td></tr>
                  <tr><td className="py-2 font-mono">product_name</td><td className="py-2">字符串</td><td className="py-2">是</td><td className="py-2">产品名称</td></tr>
                  <tr><td className="py-2 font-mono">product_type</td><td className="py-2">枚举</td><td className="py-2">是</td><td className="py-2">产品类型: bank_wealth, money_market, broker_cash</td></tr>
                  <tr><td className="py-2 font-mono">annual_return_rate</td><td className="py-2">小数</td><td className="py-2">是</td><td className="py-2">年化收益率，如 0.035 表示 3.5%</td></tr>
                  <tr><td className="py-2 font-mono">management_fee_rate</td><td className="py-2">小数</td><td className="py-2">否</td><td className="py-2">管理费率</td></tr>
                  <tr><td className="py-2 font-mono">redemption_fee_rate</td><td className="py-2">小数</td><td className="py-2">否</td><td className="py-2">赎回费率</td></tr>
                  <tr><td className="py-2 font-mono">day_count_convention</td><td className="py-2">枚举</td><td className="py-2">否</td><td className="py-2">计息方式: actual/360, actual/365, 30/360</td></tr>
                  <tr><td className="py-2 font-mono">payout_frequency</td><td className="py-2">枚举</td><td className="py-2">否</td><td className="py-2">付息频率: at_maturity, daily, monthly, quarterly</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">transactions.csv 格式</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">字段</th>
                    <th className="py-2">类型</th>
                    <th className="py-2">必填</th>
                    <th className="py-2">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2 font-mono">transaction_date</td><td className="py-2">日期</td><td className="py-2">是</td><td className="py-2">交易日期，支持 YYYY-MM-DD 等格式</td></tr>
                  <tr><td className="py-2 font-mono">transaction_amount</td><td className="py-2">金额</td><td className="py-2">是</td><td className="py-2">交易金额，正数为收入，负数为支出</td></tr>
                  <tr><td className="py-2 font-mono">description</td><td className="py-2">字符串</td><td className="py-2">否</td><td className="py-2">交易描述</td></tr>
                  <tr><td className="py-2 font-mono">account_name</td><td className="py-2">字符串</td><td className="py-2">否</td><td className="py-2">账户名称，用于关联账户</td></tr>
                  <tr><td className="py-2 font-mono">transaction_type</td><td className="py-2">枚举</td><td className="py-2">否</td><td className="py-2">交易类型: income, expense, principal_return, interest, fee</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">subscriptions.csv 格式</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">字段</th>
                    <th className="py-2">类型</th>
                    <th className="py-2">必填</th>
                    <th className="py-2">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2 font-mono">product_code</td><td className="py-2">字符串</td><td className="py-2">是</td><td className="py-2">产品代码，关联 products</td></tr>
                  <tr><td className="py-2 font-mono">holder_name</td><td className="py-2">字符串</td><td className="py-2">是</td><td className="py-2">持有人名称</td></tr>
                  <tr><td className="py-2 font-mono">share_amount</td><td className="py-2">金额</td><td className="py-2">是</td><td className="py-2">认购份额（金额）</td></tr>
                  <tr><td className="py-2 font-mono">share_ratio</td><td className="py-2">小数</td><td className="py-2">否</td><td className="py-2">分摊比例，如 0.5 表示 50%</td></tr>
                  <tr><td className="py-2 font-mono">subscription_date</td><td className="py-2">日期</td><td className="py-2">否</td><td className="py-2">认购日期</td></tr>
                  <tr><td className="py-2 font-mono">start_date</td><td className="py-2">日期</td><td className="py-2">否</td><td className="py-2">起息日</td></tr>
                  <tr><td className="py-2 font-mono">maturity_date</td><td className="py-2">日期</td><td className="py-2">否</td><td className="py-2">到期日</td></tr>
                  <tr><td className="py-2 font-mono">account_name</td><td className="py-2">字符串</td><td className="py-2">否</td><td className="py-2">账户名称</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">payout-rules.json 格式</h3>
            </div>
            <div className="p-4">
              <pre className="bg-gray-800 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "rules": [
    {
      "product_code": "PROD001",
      "day_count_convention": "actual/365",
      "payout_frequency": "at_maturity",
      "management_fee_rate": 0.005,
      "redemption_fee_rate": 0.001,
      "redemption_fee_min_days": 7,
      "redemption_fee_max_days": 30
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Import;
