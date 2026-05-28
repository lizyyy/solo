import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { Container } from '../components/layout/Container';
import { ImportWizard } from '../components/import/ImportWizard';
import { FileSpreadsheet, Upload, Download, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function DataImport() {
  const { history } = useAppStore();
  const [showWizard, setShowWizard] = useState(false);

  const importHistory = history.filter((h) => h.operationType === 'import').slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="import" onImportClick={() => setShowWizard(true)} />

      <Container>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1e3a5f]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            数据导入
          </h1>
          <p className="text-gray-600 mt-1">
            导入客户账户、质押合约、行情数据、警戒线、补仓记录和处置报告
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-[#1e3a5f]" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">开始导入</h2>
                <p className="text-gray-600 text-sm mb-4">
                  支持导入六大类数据，系统将自动识别特殊场景（停牌估值、补仓未到账、展期旧任务等）
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-6 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  打开导入向导
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Download className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">导入说明</h2>
                <ul className="text-gray-600 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>导入后自动更新质押率计算和特殊场景标记</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>所有操作都会记录到历史日志，可追溯审计</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>重复数据会自动更新而非重复插入</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">支持的数据类型</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: '👤',
                name: '客户账户',
                desc: '客户基本信息，包括账户编号、姓名、风险等级',
                fields: ['账户编号', '客户姓名', '风险等级', '联系电话'],
              },
              {
                icon: '📋',
                name: '质押合约',
                desc: '股票质押合约信息，包括质押股数、融资本金、警戒线',
                fields: ['账户编号', '股票代码', '质押股数', '融资本金', '警戒线', '平仓线'],
              },
              {
                icon: '📈',
                name: '行情数据',
                desc: '股票最新行情，支持停牌股票估值折扣处理',
                fields: ['股票代码', '最新价', '交易状态', '估值折扣'],
              },
              {
                icon: '🚨',
                name: '警戒线',
                desc: '单独更新警戒线设置，支持展期后警戒线调整',
                fields: ['账户编号', '股票代码', '警戒线', '平仓线', '展期后警戒线'],
              },
              {
                icon: '💰',
                name: '补仓记录',
                desc: '客户补仓记录，支持待到账和已到账状态',
                fields: ['账户编号', '股票代码', '补仓金额', '预计到账日', '状态'],
              },
              {
                icon: '📄',
                name: '处置报告',
                desc: '平仓处置报告，永久保存作为操作留痕',
                fields: ['账户编号', '股票代码', '报告日期', '报告内容', '状态'],
              },
            ].map((item, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg hover:border-[#1e3a5f] transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-medium text-gray-900">{item.name}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{item.desc}</p>
                <div className="text-xs text-gray-500">
                  字段：{item.fields.join('、')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {importHistory.length > 0 && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">最近导入记录</h2>
            <div className="space-y-3">
              {importHistory.map((record) => (
                <div key={record.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{record.afterValue}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {new Date(record.operateTime).toLocaleString('zh-CN')}
                      <span>·</span>
                      <span>操作人：{record.operator}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Container>

      {showWizard && (
        <ImportWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
