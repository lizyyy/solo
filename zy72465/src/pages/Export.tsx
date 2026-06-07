import { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { exportToExcel, exportToCSV, exportStreetSummary, verifyConsistency } from '@/utils/export';
import { StatusTag } from '@/components/StatusTag';

export default function ExportPage() {
  const { records, calculateConsistencyHash } = useAppStore();
  const [consistencyResult, setConsistencyResult] = useState<ReturnType<typeof verifyConsistency> | null>(null);

  const handleVerifyConsistency = () => {
    const result = verifyConsistency(records);
    setConsistencyResult(result);
  };

  const getDisplayCommunityName = (record: typeof records[0]) => {
    if (record.communityFinalName) return record.communityFinalName;
    if (record.communityNewName) return record.communityNewName;
    return record.communityOldName || '未知';
  };

  const completedRecords = records.filter(r => r.summary);
  const pendingRecords = records.filter(r => !r.summary);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'Source Han Serif SC, serif' }}
        >
          摘要导出
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          给街道会看的摘要和明细导出，确保三处数据一致
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              数据一致性校验
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              验证页面展示、导出明细、接口返回三处数据是否一致
            </p>
          </div>
          <button
            onClick={handleVerifyConsistency}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            立即校验
          </button>
        </div>
        
        {consistencyResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            consistencyResult.consistent 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {consistencyResult.consistent ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  consistencyResult.consistent ? 'text-green-800' : 'text-red-800'
                }`}>
                  {consistencyResult.message}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  页面数据哈希: {consistencyResult.details.pageHash} | 
                  导出数据哈希: {consistencyResult.details.exportHash} |
                  存储哈希: {calculateConsistencyHash()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-medium text-gray-900">导出 Excel 明细</h3>
          <p className="mt-1 text-sm text-gray-500">
            包含所有字段的完整审批记录明细
          </p>
          <button
            onClick={() => exportToExcel(records, `商业街外摆审批明细_${new Date().toLocaleDateString('zh-CN')}`)}
            className="mt-4 w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            下载 .xlsx
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900">导出 CSV 明细</h3>
          <p className="mt-1 text-sm text-gray-500">
            通用 CSV 格式，方便导入其他系统
          </p>
          <button
            onClick={() => exportToCSV(records, `商业街外摆审批明细_${new Date().toLocaleDateString('zh-CN')}`)}
            className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            下载 .csv
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="font-medium text-gray-900">街道会看摘要</h3>
          <p className="mt-1 text-sm text-gray-500">
            纯文本格式，隐藏内部操作痕迹
          </p>
          <button
            onClick={() => exportStreetSummary(records, `街道会看摘要_${new Date().toLocaleDateString('zh-CN')}`)}
            disabled={completedRecords.length === 0}
            className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              completedRecords.length > 0
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            下载 .txt
          </button>
          {completedRecords.length === 0 && (
            <p className="mt-2 text-xs text-amber-600 text-center">
              暂无可导出的摘要记录
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">街道会看摘要预览</h2>
          <p className="mt-1 text-xs text-gray-400">
            仅展示已更新摘要的记录（隐藏内部操作痕迹）
          </p>
        </div>
        
        <div className="divide-y divide-gray-100">
          {completedRecords.length > 0 ? (
            completedRecords.map((record) => (
              <div key={record.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">
                        {getDisplayCommunityName(record)}
                      </h3>
                      <StatusTag status={record.status} />
                    </div>
                    
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="text-gray-600">
                        <span className="text-gray-400">无障碍坡道：</span>
                        {record.rampRecord.exists ? '有' : '无'}
                        {record.rampRecord.location && ` - ${record.rampRecord.location}`}
                        {record.rampRecord.condition && ` (${record.rampRecord.condition})`}
                      </div>
                      {record.samplingPoint && (
                        <div className="text-gray-600">
                          <span className="text-gray-400">夜间采样点：</span>
                          {record.samplingPoint.exists ? '有' : '无'}
                          {record.samplingPoint.location && ` - ${record.samplingPoint.location}`}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        <span className="text-gray-400 mr-2">摘要：</span>
                        {record.summary?.content}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>暂无已更新摘要的记录</p>
              <p className="mt-1 text-sm">完成三步流程后会显示在这里</p>
            </div>
          )}
        </div>
      </div>

      {pendingRecords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">
                还有 {pendingRecords.length} 条记录未完成摘要更新
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                请先完成「阿宁补看夜间采样点」和「更新街道会看摘要」步骤
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
