import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileJson, FileSpreadsheet, CheckCircle } from 'lucide-react';

export default function Export() {
  const navigate = useNavigate();
  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('json');
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'id', 'teamName', 'responsiblePerson', 'phone', 'returnDate',
    'submitSource', 'status', 'deviceCount', 'hasIssues', 'issueCount'
  ]);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    teamName: ''
  });
  const [exportData, setExportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const availableFields = [
    { key: 'id', label: '归还单号', category: '基本信息' },
    { key: 'teamName', label: '讲解组名称', category: '基本信息' },
    { key: 'responsiblePerson', label: '负责人姓名', category: '基本信息' },
    { key: 'phone', label: '联系电话', category: '基本信息' },
    { key: 'returnDate', label: '归还日期', category: '基本信息' },
    { key: 'submitSource', label: '提交来源', category: '提交信息' },
    { key: 'submitTime', label: '提交时间', category: '提交信息' },
    { key: 'operator', label: '操作者', category: '提交信息' },
    { key: 'status', label: '状态', category: '状态信息' },
    { key: 'deviceCount', label: '设备数量', category: '设备信息' },
    { key: 'hasIssues', label: '是否有问题', category: '校验信息' },
    { key: 'issueCount', label: '问题数量', category: '校验信息' },
    { key: 'devices', label: '设备清单', category: '设备信息' }
  ];

  const toggleField = (key: string) => {
    setSelectedFields(prev =>
      prev.includes(key)
        ? prev.filter(f => f !== key)
        : [...prev, key]
    );
  };

  const selectAllFields = () => {
    setSelectedFields(availableFields.map(f => f.key));
  };

  const clearAllFields = () => {
    setSelectedFields([]);
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      alert('请至少选择一个字段');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: exportFormat,
          fields: selectedFields,
          filters: {
            status: filters.status || undefined,
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
            teamName: filters.teamName || undefined
          },
          includeDevices: selectedFields.includes('devices')
        })
      });
      const data = await response.json();
      if (data.success) {
        setExportData(data.data);
        if (exportFormat === 'json') {
          downloadJson(data.data);
        }
      }
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = (data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `讲解器归还数据_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedFields = availableFields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof availableFields>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-200 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <h1 className="text-2xl font-bold">数据导出</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">导出格式</h2>
          </div>
          <div className="p-6">
            <div className="flex gap-4">
            <button
                onClick={() => setExportFormat('json')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                  exportFormat === 'json'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileJson className="w-8 h-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">JSON 格式</p>
                  <p className="text-sm text-gray-500">结构化数据，便于程序处理</p>
                </div>
                {exportFormat === 'json' && <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />}
              </button>
              <button
                onClick={() => setExportFormat('excel')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                  exportFormat === 'excel'
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">表格格式</p>
                  <p className="text-sm text-gray-500">Excel 兼容，便于阅读分析</p>
                </div>
                {exportFormat === 'excel' && <CheckCircle className="w-5 h-5 text-green-600 ml-auto" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">选择导出字段</h2>
            <div className="flex gap-2">
              <button
                onClick={selectAllFields}
                className="text-sm text-blue-600 hover:text-blue-800">全选</button>
              <span className="text-gray-300">|</span>
              <button
                onClick={clearAllFields}
                className="text-sm text-gray-600 hover:text-gray-800">清空</button>
            </div>
          </div>
          <div className="p-6">
            {Object.entries(groupedFields).map(([category, fields]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{category}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fields.map(field => (
                    <label
                      key={field.key}
                      className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.key)}
                        onChange={() => toggleField(field.key)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">筛选条件</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">状态筛选</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="pending">待审核</option>
                <option value="approved">审核通过</option>
                <option value="rejected">审核驳回</option>
                <option value="ownership_issue">归属不清</option>
                <option value="processing">处理中</option>
                <option value="stored">设备入库</option>
                <option value="completed">已完成</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">讲解组名称</label>
              <input
                type="text"
                value={filters.teamName}
                onChange={(e) => setFilters({ ...filters, teamName: e.target.value })}
                placeholder="输入讲解组名称"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {exportData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">导出预览</h2>
            </div>
            <div className="p-6">
              <div className="mb-4 text-sm text-gray-600">
                共 {exportData.total} 条记录，{exportData.fields.length} 个字段
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {exportData.fields.map((field: any) => (
                      <th key={field.key} className="px-4 py-3 text-left text-gray-700 font-medium whitespace-nowrap">
                        {field.label}
                      </th>
                    ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {exportData.records.slice(0, 10).map((record: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {exportData.fields.map((field: any) => (
                          <td key={field.key} className="px-4 py-3 whitespace-nowrap">
                            {Array.isArray(record[field.key])
                              ? `${record[field.key].length} 台设备`
                              : typeof record[field.key] === 'boolean'
                              ? record[field.key] ? '是' : '否'
                              : record[field.key] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {exportData.records.length > 10 && (
                <p className="mt-4 text-sm text-gray-500 text-center">
                  仅显示前 10 条记录，完整数据请下载文件
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={loading || selectedFields.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {loading ? '导出中...' : '开始导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
