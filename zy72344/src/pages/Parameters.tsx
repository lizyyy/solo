import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Clock, User, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/store';
import type { ParameterRecord } from '@/types';

const Parameters: React.FC = () => {
  const { parameterTables, addParameterTable, currentUser } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'duplicate'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const records: ParameterRecord[] = jsonData.map((row, index) => ({
        id: `record-${Date.now()}-${index}`,
        name: row['名称'] || row['name'] || `参数${index + 1}`,
        value: Number(row['值'] || row['value']) || 0,
        constraint: row['约束'] || row['constraint'] || '',
      }));

      const success = addParameterTable({
        name: file.name.replace(/\.[^/.]+$/, ''),
        version: `v${(parameterTables.length + 1).toFixed(1)}`,
        importedBy: currentUser,
        records,
      });

      setUploadStatus(success ? 'success' : 'duplicate');
      setTimeout(() => setUploadStatus('idle'), 3000);
    };
    reader.readAsBinaryString(file);
  };

  const handleDemoImport = () => {
    const demoRecords: ParameterRecord[] = [
      { id: 'demo-1', name: '蛋白质需求', value: 65, constraint: '>= 50' },
      { id: 'demo-2', name: '热量上限', value: 2000, constraint: '<= 2500' },
      { id: 'demo-3', name: '脂肪占比', value: 25, constraint: '20-30%' },
      { id: 'demo-4', name: '碳水化合物', value: 250, constraint: '>= 200' },
    ];

    const success = addParameterTable({
      name: '演示参数表',
      version: `v${(parameterTables.length + 1).toFixed(1)}`,
      importedBy: currentUser,
      records: demoRecords,
    });

    setUploadStatus(success ? 'success' : 'duplicate');
    setTimeout(() => setUploadStatus('idle'), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">参数调试表</h1>
          <p className="text-slate-500 mt-1">管理配餐计算的参数配置，支持Excel导入</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={handleDemoImport}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            导入演示数据
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入Excel
          </button>
        </div>
      </div>

      {uploadStatus !== 'idle' && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            uploadStatus === 'success'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-amber-50 border border-amber-200'
          }`}
        >
          {uploadStatus === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600" />
          )}
          <span
            className={
              uploadStatus === 'success' ? 'text-emerald-700' : 'text-amber-700'
            }
          >
            {uploadStatus === 'success'
              ? '参数表导入成功！'
              : '检测到重复内容，已跳过导入（数量未翻倍）'}
          </span>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">同一学生多版答案处理说明</p>
            <p className="text-sm text-amber-700 mt-1">
              当系统检测到同一学生提交多版答案时，会自动标记为"复核中"状态，由业务运营团队进行人工复核。
              教研负责人吴老师可以补充手算反例帮助判断。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {[...parameterTables].reverse().map((table) => (
          <div
            key={table.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedId(expandedId === table.id ? null : table.id)}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{table.name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {table.importedAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {table.importedBy}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                  {table.version}
                </span>
                <span className="text-sm text-slate-500">
                  {table.records.length} 条记录
                </span>
                {expandedId === table.id ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>

            {expandedId === table.id && (
              <div className="border-t border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        参数名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        参数值
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        约束条件
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {table.records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                          {record.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {record.value}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          <code className="px-2 py-1 bg-slate-100 rounded text-xs">
                            {record.constraint}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Parameters;
