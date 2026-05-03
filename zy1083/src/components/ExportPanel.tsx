import React, { useState } from 'react';
import { useApp, useShortlist } from '../context/AppContext';
import {
  downloadProjectJson,
  downloadMarkdownReport,
  downloadHtmlReport,
} from '../utils/exporter';

const ExportPanel: React.FC = () => {
  const { state, exportProject } = useApp();
  const { shortlist } = useShortlist();
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeShortlistOnly: false,
    includeAllHouses: true,
    format: 'json' as 'json' | 'markdown' | 'html',
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportOptions.format === 'json') {
        const projectData = exportProject();
        downloadProjectJson(projectData);
      } else if (exportOptions.format === 'markdown') {
        downloadMarkdownReport(
          state.scoredHouses,
          shortlist,
          state.ratingConfig,
          {
            includeAllHouses: exportOptions.includeAllHouses,
            includeShortlistOnly: exportOptions.includeShortlistOnly,
          }
        );
      } else if (exportOptions.format === 'html') {
        downloadHtmlReport(
          state.scoredHouses,
          shortlist,
          state.ratingConfig,
          {
            includeAllHouses: exportOptions.includeAllHouses,
            includeShortlistOnly: exportOptions.includeShortlistOnly,
          }
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatDescription = () => {
    switch (exportOptions.format) {
      case 'json':
        return '导出完整的项目数据，可以随时重新导入恢复所有内容（包括房源、看房记录、短名单、评分配置等）。';
      case 'markdown':
        return '导出结构化的 Markdown 报告，包含房源对比、评分明细、风险分析和待确认问题，方便用 Markdown 编辑器查看和编辑。';
      case 'html':
        return '导出格式美观的 HTML 报告，可以直接在浏览器中打开查看，包含样式和交互效果。';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-gray-900">数据导出</h1>
        <p className="text-gray-500 mt-1">
          导出您的看房数据和报告，方便备份、分享或进一步分析
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">选择导出格式</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setExportOptions((prev) => ({ ...prev, format: 'json' }))}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  exportOptions.format === 'json'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    exportOptions.format === 'json' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-900">JSON</span>
                </div>
                <p className="text-xs text-gray-500">
                  完整项目数据
                </p>
              </button>

              <button
                onClick={() => setExportOptions((prev) => ({ ...prev, format: 'markdown' }))}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  exportOptions.format === 'markdown'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    exportOptions.format === 'markdown' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-900">Markdown</span>
                </div>
                <p className="text-xs text-gray-500">
                  结构化报告
                </p>
              </button>

              <button
                onClick={() => setExportOptions((prev) => ({ ...prev, format: 'html' }))}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  exportOptions.format === 'html'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    exportOptions.format === 'html' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-900">HTML</span>
                </div>
                <p className="text-xs text-gray-500">
                  美观网页报告
                </p>
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{getFormatDescription()}</p>
            </div>
          </div>

          {exportOptions.format !== 'json' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">导出内容选项</h3>
              
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="contentOption"
                    checked={!exportOptions.includeShortlistOnly && exportOptions.includeAllHouses}
                    onChange={() =>
                      setExportOptions((prev) => ({
                        ...prev,
                        includeShortlistOnly: false,
                        includeAllHouses: true,
                      }))
                    }
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">导出所有房源</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      包含 {state.scoredHouses.length} 套房源的完整对比和评分明细
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="contentOption"
                    checked={exportOptions.includeShortlistOnly}
                    onChange={() =>
                      setExportOptions((prev) => ({
                        ...prev,
                        includeShortlistOnly: true,
                        includeAllHouses: false,
                      }))
                    }
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    disabled={shortlist.length === 0}
                  />
                  <div>
                    <span className={`text-sm font-medium ${
                      shortlist.length === 0 ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      仅导出短名单
                    </span>
                    <p className={`text-xs mt-0.5 ${
                      shortlist.length === 0 ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {shortlist.length === 0
                        ? '短名单为空，请先添加房源到短名单'
                        : `只包含短名单中的 ${shortlist.length} 套房源，重点关注风险分析和待确认问题`}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">当前数据概览</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">房源总数</p>
                  <p className="text-2xl font-bold text-gray-900">{state.scoredHouses.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">短名单</p>
                  <p className="text-2xl font-bold text-blue-600">{shortlist.length}</p>
                </div>
              </div>

              {state.scoredHouses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">评分分布</p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 bg-green-50 rounded">
                      <p className="text-lg font-bold text-green-600">
                        {state.scoredHouses.filter((h) => h.overallGrade === 'excellent').length}
                      </p>
                      <p className="text-xs text-green-600">优秀</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded">
                      <p className="text-lg font-bold text-blue-600">
                        {state.scoredHouses.filter((h) => h.overallGrade === 'good').length}
                      </p>
                      <p className="text-xs text-blue-600">良好</p>
                    </div>
                    <div className="p-2 bg-yellow-50 rounded">
                      <p className="text-lg font-bold text-yellow-600">
                        {state.scoredHouses.filter((h) => h.overallGrade === 'fair').length}
                      </p>
                      <p className="text-xs text-yellow-600">一般</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded">
                      <p className="text-lg font-bold text-red-600">
                        {state.scoredHouses.filter((h) => h.overallGrade === 'poor').length}
                      </p>
                      <p className="text-xs text-red-600">较差</p>
                    </div>
                  </div>
                </div>
              )}

              {state.isUsingExampleData && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">
                    💡 当前使用的是示例数据，您可以导入自己的真实数据
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">导出操作</h3>
            
            <button
              onClick={handleExport}
              disabled={isExporting || state.scoredHouses.length === 0}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  导出中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  导出 {exportOptions.format.toUpperCase()}
                </>
              )}
            </button>

            {state.scoredHouses.length === 0 && (
              <p className="text-sm text-gray-500 text-center mt-3">
                请先导入数据或加载示例数据
              </p>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">💡 小贴士</h4>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• JSON 格式适合备份和恢复数据</li>
              <li>• Markdown 格式适合用笔记软件整理</li>
              <li>• HTML 格式适合打印或分享给他人查看</li>
              <li>• 签约前建议导出 HTML 报告，逐条核对待确认问题</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
