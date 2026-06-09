import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  Layers,
  ArrowRight,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/store';
import type { ParameterRecord } from '@/types';

const Parameters: React.FC = () => {
  const navigate = useNavigate();
  const {
    parameterTables,
    addParameterTable,
    currentUser,
    lastImportStatus,
    clearLastImportStatus,
    getLatestMealPlan,
  } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lastImportStatus) {
      const timer = setTimeout(() => clearLastImportStatus(), 6000);
      return () => clearTimeout(timer);
    }
  }, [lastImportStatus, clearLastImportStatus]);

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

      addParameterTable({
        name: file.name.replace(/\.[^/.]+$/, ''),
        version: `v${(parameterTables.length + 1).toFixed(1)}`,
        importedBy: currentUser,
        records,
      });
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDemoImport = () => {
    const demoRecords: ParameterRecord[] = [
      { id: 'demo-1', name: '蛋白质需求', value: 65, constraint: '>= 50' },
      { id: 'demo-2', name: '热量上限', value: 2000, constraint: '<= 2500' },
      { id: 'demo-3', name: '脂肪占比', value: 25, constraint: '20-30%' },
      { id: 'demo-4', name: '碳水化合物', value: 250, constraint: '>= 200' },
    ];

    addParameterTable({
      name: '演示参数表',
      version: `v${(parameterTables.length + 1).toFixed(1)}`,
      importedBy: currentUser,
      records: demoRecords,
    });
  };

  const handleReimportSame = () => {
    if (parameterTables.length === 0) return;
    const latest = [...parameterTables].sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    )[0];
    addParameterTable({
      name: latest.name + '（重复测试）',
      version: latest.version,
      importedBy: currentUser,
      records: [...latest.records].map((r) => ({ ...r, id: r.id + '-dup' })),
    });
  };

  const latestMealPlan = getLatestMealPlan();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">参数调试表</h1>
          <p className="text-slate-500 mt-1">
            管理配餐计算的参数配置。三步流程：①导入参数 → ②补看手算反例 → ③查看误差说明报告
          </p>
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
            onClick={handleReimportSame}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            测试重复导入
          </button>
          <button
            onClick={handleDemoImport}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Layers className="w-4 h-4" />
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

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">参数表总数</p>
              <p className="text-2xl font-bold text-slate-800">
                {parameterTables.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">最新参数版本</p>
              <p className="text-2xl font-bold text-slate-800">
                {parameterTables.length > 0
                  ? [...parameterTables].sort(
                      (a, b) =>
                        new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
                    )[0].version
                  : '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">报告中待处理误差</p>
              <p className="text-2xl font-bold text-slate-800">
                {latestMealPlan?.errors.filter((e) => !e.resolved).length || 0}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/reports')}
          className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-4 text-left text-white hover:from-slate-700 hover:to-slate-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400">查看报告</p>
              <p className="text-lg font-bold flex items-center gap-1">
                误差说明 <ArrowRight className="w-4 h-4" />
              </p>
            </div>
          </div>
        </button>
      </div>

      {lastImportStatus && (
        <div
          className={`flex items-start gap-4 p-5 rounded-xl border ${
            lastImportStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          {lastImportStatus.type === 'success' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h4
              className={`font-semibold ${
                lastImportStatus.type === 'success'
                  ? 'text-emerald-800'
                  : 'text-amber-800'
              }`}
            >
              {lastImportStatus.type === 'success'
                ? '✅ 参数表导入成功（三步流程 - 第①步完成）'
                : '⚠️ 已触发重复导入去重机制（数量未翻倍）'}
            </h4>
            <p
              className={`text-sm mt-1 ${
                lastImportStatus.type === 'success'
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }`}
            >
              {lastImportStatus.message}
            </p>
            <div className="flex items-center gap-6 mt-3 text-xs">
              <div>
                <span
                  className={
                    lastImportStatus.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }
                >
                  导入前参数表数量：
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {lastImportStatus.countBefore}
                </span>
              </div>
              <div>
                <span
                  className={
                    lastImportStatus.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }
                >
                  导入后参数表数量：
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {lastImportStatus.countAfter}
                </span>
              </div>
              <div>
                <span
                  className={
                    lastImportStatus.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }
                >
                  计数变化：
                </span>
                <span
                  className={`font-mono font-bold ${
                    lastImportStatus.countAfter === lastImportStatus.countBefore
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {lastImportStatus.countAfter === lastImportStatus.countBefore
                    ? '→ 不变（去重生效）'
                    : `+${lastImportStatus.countAfter - lastImportStatus.countBefore}`}
                </span>
              </div>
            </div>
            {lastImportStatus.type === 'success' && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => navigate('/answers')}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-md hover:bg-emerald-700"
                >
                  ② 前往补看手算反例 →
                </button>
                <button
                  onClick={() => navigate('/reports')}
                  className="px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md hover:bg-slate-700"
                >
                  ③ 查看误差说明报告 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">
              🔔 业务运营 & 教研负责人吴老师须知
            </p>
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div className="bg-white/60 rounded-lg p-3">
                <p className="font-medium text-amber-700">① 参数表第一次导入</p>
                <p className="text-amber-600 mt-1">
                  点击"导入演示数据"或上传Excel，系统会自动生成最新配餐报告并列出所有待复核误差
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="font-medium text-amber-700">② 吴老师补看手算反例</p>
                <p className="text-amber-600 mt-1">
                  进入"学生答案"→"答案详情"→ 补充手算反例，系统会实时同步到报告误差说明中
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="font-medium text-amber-700">③ 误差说明更新</p>
                <p className="text-amber-600 mt-1">
                  同一学生两版答案别急着归正常，留待业务运营复核。报告中保留原始说法、改后值、处理原因和下一步找谁
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {[...parameterTables]
          .sort(
            (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
          )
          .map((table) => (
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800">{table.name}</h3>
                      {table.id ===
                        [...parameterTables].sort(
                          (a, b) =>
                            new Date(b.importedAt).getTime() -
                            new Date(a.importedAt).getTime()
                        )[0]?.id && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                          当前生效
                        </span>
                      )}
                    </div>
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
                  <div className="bg-slate-50 px-6 py-2 text-xs text-slate-500 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    内容哈希：
                    <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {table.hash.substring(0, 32)}...
                    </code>
                    <span className="text-slate-400">（重复导入比对依据）</span>
                  </div>
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

        {parameterTables.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">暂无参数表，点击"导入演示数据"开始走样例流程</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Parameters;
