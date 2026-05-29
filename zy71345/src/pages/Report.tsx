import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileJson,
  Printer,
  Eye,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Users,
  Music,
  BookOpen,
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getCheckSummary } from '../services/checkService';
import { exportToExcel, exportToPDF, exportJSON, exportVersionsJSON } from '../utils/export';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { StatusBadge } from '../components/common/StatusBadge';

export default function Report() {
  const navigate = useNavigate();
  const { currentData, checkResults, isChecked, versions, currentVersionId } = useDataStore();
  const [includeParts, setIncludeParts] = useState(true);
  const [includeMusicians, setIncludeMusicians] = useState(true);
  const [includeRevisions, setIncludeRevisions] = useState(true);
  const [includeDistributions, setIncludeDistributions] = useState(true);
  const [includeExceptions, setIncludeExceptions] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const summary = isChecked ? getCheckSummary(checkResults) : null;
  const currentVersion = versions.find((v) => v.id === currentVersionId);

  const openErrors = useMemo(
    () => checkResults.filter((r) => r.status === 'open' && r.severity === 'error'),
    [checkResults]
  );
  const openWarnings = useMemo(
    () => checkResults.filter((r) => r.status === 'open' && r.severity === 'warning'),
    [checkResults]
  );

  const handleExportExcel = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    exportToExcel(currentData, checkResults);
    setIsGenerating(false);
  };

  const handleExportPDF = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    exportToPDF(currentData, checkResults);
    setIsGenerating(false);
  };

  const handleExportJSON = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    exportJSON(currentData);
    setIsGenerating(false);
  };

  const handleExportVersions = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    exportVersionsJSON(versions);
    setIsGenerating(false);
  };

  const hasData = currentData.parts.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <FileText className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">暂无数据</h2>
        <p className="text-gray-500 mb-8">请先导入数据并执行检查</p>
        <button
          onClick={() => navigate('/import')}
          className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span>去导入数据</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-800">报告导出</h2>
          <p className="text-gray-500 mt-1">生成并下载检查报告</p>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 text-primary-600">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span>生成中...</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">导出格式</h3>
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={handleExportExcel}
            disabled={isGenerating}
            className="flex flex-col items-center gap-3 p-6 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 hover:border-green-300 transition-all disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-800">Excel 报告</div>
              <div className="text-sm text-green-600">.xlsx 格式</div>
            </div>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isGenerating}
            className="flex flex-col items-center gap-3 p-6 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-red-800">PDF 报告</div>
              <div className="text-sm text-red-600">.pdf 格式</div>
            </div>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={isGenerating}
            className="flex flex-col items-center gap-3 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <FileJson className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-800">原始数据</div>
              <div className="text-sm text-blue-600">.json 格式</div>
            </div>
          </button>

          <button
            onClick={handleExportVersions}
            disabled={isGenerating || versions.length < 2}
            className="flex flex-col items-center gap-3 p-6 bg-purple-50 border-2 border-purple-200 rounded-xl hover:bg-purple-100 hover:border-purple-300 transition-all disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-purple-800">版本备份</div>
              <div className="text-sm text-purple-600">全部版本</div>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">报告内容配置</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={includeParts}
              onChange={(e) => setIncludeParts(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-800">声部谱信息</div>
              <div className="text-sm text-gray-500">包含各声部的页码信息</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={includeMusicians}
              onChange={(e) => setIncludeMusicians(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-800">乐手名单</div>
              <div className="text-sm text-gray-500">包含乐手姓名和所属声部</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={includeRevisions}
              onChange={(e) => setIncludeRevisions(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-800">修订页信息</div>
              <div className="text-sm text-gray-500">包含修订页及其适用声部</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={includeDistributions}
              onChange={(e) => setIncludeDistributions(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-800">发放记录</div>
              <div className="text-sm text-gray-500">包含每位乐手的发放详情</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={includeExceptions}
              onChange={(e) => setIncludeExceptions(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-800">异常汇总</div>
              <div className="text-sm text-gray-500">包含所有检查出的异常情况</div>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">报告预览</h3>
        
        <div className="border rounded-lg p-6 bg-gray-50">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-serif font-bold text-gray-800">管弦乐谱缺页检查报告</h2>
            <p className="text-gray-500 mt-1">
              生成时间：{format(new Date(), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
            </p>
            {currentVersion && (
              <p className="text-sm text-gray-400 mt-1">数据版本：{currentVersion.name}</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-white rounded-lg">
              <Music className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-800">{currentData.parts.length}</div>
              <div className="text-xs text-gray-500">声部</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <Users className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-800">{currentData.musicians.length}</div>
              <div className="text-xs text-gray-500">乐手</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <BookOpen className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-800">{currentData.revisions.length}</div>
              <div className="text-xs text-gray-500">修订页</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-gray-800">{currentData.distributions.length}</div>
              <div className="text-xs text-gray-500">发放记录</div>
            </div>
          </div>

          {summary && (
            <>
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">检查结果摘要</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    <div>
                      <div className="text-lg font-bold text-gray-800">{summary.resolved}</div>
                      <div className="text-sm text-gray-500">已解决</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <div>
                      <div className="text-lg font-bold text-red-600">{summary.errors}</div>
                      <div className="text-sm text-gray-500">错误</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <AlertTriangle className="w-8 h-8 text-yellow-500" />
                    <div>
                      <div className="text-lg font-bold text-yellow-600">{summary.warnings}</div>
                      <div className="text-sm text-gray-500">警告</div>
                    </div>
                  </div>
                </div>
              </div>

              {openErrors.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    待处理错误 ({openErrors.length})
                  </h4>
                  <div className="space-y-2">
                    {openErrors.slice(0, 5).map((error) => (
                      <div key={error.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {openWarnings.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    待处理警告 ({openWarnings.length})
                  </h4>
                  <div className="space-y-2">
                    {openWarnings.slice(0, 5).map((warning) => (
                      <div key={warning.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">{warning.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!isChecked && (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
              <p className="text-gray-600">尚未执行检查，请先执行检查以查看结果</p>
              <button
                onClick={() => navigate('/check')}
                className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                去执行检查
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
