import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { recordApi, demoApi } from '../services/api';
import {
  DocumentArrowUpIcon,
  TableCellsIcon,
  PlayCircleIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

export default function ImportPage() {
  const { state, loadRecords } = useApp();
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [tradeDate, setTradeDate] = useState('');
  const [expectedDate, setExpectedDate] = useState<any>(null);

  const sampleData = [
    {
      tradeDate: '2024-10-31',
      actualArrivalDate: '2024-11-05',
      amount: 1800000,
      fundCode: 'FUND-003',
      futuresCode: 'IF2411'
    },
    {
      tradeDate: '2024-12-20',
      actualArrivalDate: '2024-12-23',
      amount: 960000,
      fundCode: 'FUND-001',
      futuresCode: 'IC2412'
    }
  ];

  const handleImport = async () => {
    setImporting(true);
    try {
      let records;
      if (importData.trim()) {
        records = JSON.parse(importData);
      } else {
        records = sampleData;
      }
      
      const response = await recordApi.importRecords(records, state.currentUser.name);
      if (response.data.success) {
        setImportResult(response.data);
        await loadRecords();
      }
    } catch (error: any) {
      setImportResult({ success: false, message: error.message || '导入失败，请检查数据格式' });
    } finally {
      setImporting(false);
    }
  };

  const handleCalculateDate = async () => {
    if (!tradeDate) return;
    try {
      const response = await demoApi.calculateExpectedDate(tradeDate);
      if (response.data.success) {
        setExpectedDate(response.data.data);
      }
    } catch (error) {
      console.error('计算失败:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-serif-sc text-gray-900">数据导入看板</h2>
        <p className="text-sm text-gray-500 mt-1">导入交割仓单数据，系统自动标记T+1→T+2修改并生成对账说明</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <DocumentArrowUpIcon className="w-5 h-5 text-finance-600" />
            <span>导入交割数据</span>
          </h3>

          <div className="mb-4">
            <label className="label">JSON数据（留空使用示例数据）</label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="input font-mono text-xs"
              rows={8}
              placeholder={JSON.stringify(sampleData, null, 2)}
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-primary flex items-center space-x-2"
            >
              <DocumentArrowUpIcon className="w-4 h-4" />
              <span>{importing ? '导入中...' : '导入数据'}</span>
            </button>
            <button
              onClick={() => setImportData(JSON.stringify(sampleData, null, 2))}
              className="btn-secondary text-sm"
            >
              填充示例数据
            </button>
          </div>

          {importResult && (
            <div className={`mt-4 p-4 rounded ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className={`text-sm font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {importResult.message || (importResult.success ? '导入成功' : '导入失败')}
              </div>
              {importResult.data && (
                <div className="mt-2 text-sm text-gray-700">
                  <div>导入数量: {importResult.data.imported}</div>
                  <div>T+1→T+2修改: {importResult.data.hasManualModifications}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <CalendarDaysIcon className="w-5 h-5 text-finance-600" />
              <span>节假日顺延计算</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="label">交易日期</label>
                <input
                  type="date"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  className="input"
                />
              </div>
              <button onClick={handleCalculateDate} className="btn-primary w-full">
                计算T+1到账日
              </button>

              {expectedDate && (
                <div className="bg-blue-50 p-4 rounded border border-blue-100 animate-fade-in">
                  <div className="text-sm text-blue-800">
                    <div>交易日: <strong>{expectedDate.tradeDate}</strong></div>
                    <div>预期到账日: <strong>{expectedDate.expectedArrivalDate}</strong></div>
                    <div>工作日: <strong>{expectedDate.workingDays}天</strong></div>
                    <div className="mt-1 text-xs text-blue-600">{expectedDate.explanation}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <TableCellsIcon className="w-5 h-5 text-finance-600" />
              <span>已配置节假日</span>
            </h3>
            <div className="max-h-60 overflow-y-auto scrollbar-thin">
              {state.holidays.length === 0 ? (
                <p className="text-sm text-gray-500">暂无节假日配置</p>
              ) : (
                <div className="space-y-1">
                  {state.holidays.map((holiday) => (
                    <div key={holiday.date} className="flex items-center justify-between text-sm py-1.5 px-2 hover:bg-gray-50 rounded">
                      <span className="text-gray-700">{holiday.date}</span>
                      <span className="text-gray-900 font-medium">{holiday.name}</span>
                      <span className={`badge ${holiday.type === 'public_holiday' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {holiday.type === 'public_holiday' ? '法定假日' : '周末'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
