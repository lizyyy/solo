import React, { useState } from 'react';
import { exportApi } from '../api';
import { ApiResponseStatus } from '../types';
import ApiResponseAlert from '../components/ApiResponseAlert';
import { Download, FileText } from 'lucide-react';

const ExportPage: React.FC = () => {
  const [alert, setAlert] = useState<{ status: ApiResponseStatus; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.downloadUnpublishRecords();
      setAlert({
        status: ApiResponseStatus.SUCCESS,
        message: '下架记录导出成功',
      });
    } catch (error) {
      setAlert({
        status: ApiResponseStatus.BLOCKED,
        message: '导出失败，请稍后重试',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">数据导出</h1>
      </div>

      {alert && (
        <ApiResponseAlert
          status={alert.status}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">下架记录导出</h3>
              <p className="mt-1 text-sm text-gray-500">
                导出所有已下架插件版本的详细记录，包括处理人、时间、安全扫描结果等信息。
              </p>
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">包含字段：</h4>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• 插件名称</li>
                  <li>• 版本号</li>
                  <li>• 下架原因</li>
                  <li>• 处理人</li>
                  <li>• 处理时间</li>
                  <li>• 安全扫描状态</li>
                  <li>• 问题统计（严重/高危/中危）</li>
                </ul>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? '导出中...' : '导出 CSV'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-100 rounded-lg opacity-50">
              <FileText className="w-6 h-6 text-gray-600" />
            </div>
            <div className="flex-1 opacity-50">
              <h3 className="font-semibold text-gray-900">审核记录导出</h3>
              <p className="mt-1 text-sm text-gray-500">
                导出所有版本的审核历史记录，包括审核人、审核时间、审核意见等。
              </p>
              <button
                disabled
                className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
              >
                即将上线
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-100 rounded-lg opacity-50">
              <FileText className="w-6 h-6 text-gray-600" />
            </div>
            <div className="flex-1 opacity-50">
              <h3 className="font-semibold text-gray-900">安全扫描报告</h3>
              <p className="mt-1 text-sm text-gray-500">
                导出所有版本的安全扫描详细报告，包括发现的问题、严重程度、位置等。
              </p>
              <button
                disabled
                className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
              >
                即将上线
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
