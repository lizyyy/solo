import React, { useState } from 'react';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportApi } from '../services/api';
import { downloadFile } from '../utils/helpers';

const ExportPage = () => {
  const [exporting, setExporting] = useState(null);

  const handleExportMarkdown = async () => {
    setExporting('markdown');
    try {
      const response = await exportApi.getMarkdownReport();
      const today = new Date().toISOString().split('T')[0];
      downloadFile(response.data, `绳索安全评估报告_${today}.md`);
      toast.success('Markdown 报告导出成功');
    } catch (error) {
      toast.error('导出失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setExporting(null);
    }
  };

  const handleExportScrapList = async () => {
    setExporting('scrap');
    try {
      const response = await exportApi.getScrapList();
      const today = new Date().toISOString().split('T')[0];
      downloadFile(response.data, `报废清单_${today}.csv`);
      toast.success('报废清单导出成功');
    } catch (error) {
      toast.error('导出失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setExporting(null);
    }
  };

  const handleExportRopeSummary = async () => {
    setExporting('summary');
    try {
      const response = await exportApi.getRopeSummary();
      const today = new Date().toISOString().split('T')[0];
      downloadFile(response.data, `绳索汇总_${today}.csv`);
      toast.success('绳索汇总导出成功');
    } catch (error) {
      toast.error('导出失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <div className="header">
        <h2>报告导出</h2>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <h3>导出选项</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText size={24} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">Markdown 报告</h4>
                  <p className="text-sm text-secondary">详细的安全评估报告</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                包含所有绳索的风险评估详情、更换建议和风险等级说明。
              </p>
              <button
                className="btn btn-primary w-full"
                onClick={handleExportMarkdown}
                disabled={exporting === 'markdown'}
              >
                {exporting === 'markdown' ? (
                  <><span className="spinner" /> 导出中...</>
                ) : (
                  <><Download size={16} /> 导出报告</>
                )}
              </button>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <FileSpreadsheet size={24} className="text-red-600" />
                </div>
                <div>
                  <h4 className="font-medium">报废清单</h4>
                  <p className="text-sm text-secondary">高风险绳索列表</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                包含所有风险等级为"报废"、"严重"和已报废绳索的详细清单。
              </p>
              <button
                className="btn btn-danger w-full"
                onClick={handleExportScrapList}
                disabled={exporting === 'scrap'}
              >
                {exporting === 'scrap' ? (
                  <><span className="spinner" /> 导出中...</>
                ) : (
                  <><Download size={16} /> 导出清单</>
                )}
              </button>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileSpreadsheet size={24} className="text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">绳索汇总</h4>
                  <p className="text-sm text-secondary">全部绳索状态</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                包含所有绳索的完整状态信息，包括风险等级、使用情况和磨损等级。
              </p>
              <button
                className="btn btn-secondary w-full"
                onClick={handleExportRopeSummary}
                disabled={exporting === 'summary'}
              >
                {exporting === 'summary' ? (
                  <><span className="spinner" /> 导出中...</>
                ) : (
                  <><Download size={16} /> 导出汇总</>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>报告内容说明</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Markdown 安全评估报告</h4>
              <ul className="text-sm text-secondary list-disc list-inside space-y-1">
                <li>风险概览统计（各风险等级绳索数量）</li>
                <li>报废建议（立即报废的绳索详情）</li>
                <li>高风险绳索（优先更换建议）</li>
                <li>注意监测绳索列表</li>
                <li>已报废绳索历史记录</li>
                <li>风险等级说明对照表</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">报废清单 CSV</h4>
              <ul className="text-sm text-secondary list-disc list-inside space-y-1">
                <li>绳索编号、品牌、型号</li>
                <li>购买日期、风险等级</li>
                <li>累计冲坠能量、使用天数</li>
                <li>磨损等级、风险因素</li>
                <li>更换建议</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">绳索汇总 CSV</h4>
              <ul className="text-sm text-secondary list-disc list-inside space-y-1">
                <li>所有绳索的完整信息</li>
                <li>包括使用中、已报废状态</li>
                <li>风险等级和评估日期</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="alert alert-info">
          <FileText size={16} className="inline mr-2" />
          <strong>提示：</strong>导出的报告基于当前数据库中的最新风险评估数据。如果最近导入了新数据，请先执行"全部评估"以更新风险状态。
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
