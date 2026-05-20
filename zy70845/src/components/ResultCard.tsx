import React from 'react';
import { NormalItem, PendingItem, FailedItem, ImportResponse } from '../../shared/types';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Props {
  result: ImportResponse;
}

export default function ResultCard({ result }: Props) {
  const [expandedSections, setExpandedSections] = useState<{
    normal: boolean;
    pending: boolean;
    failed: boolean;
  }>({
    normal: false,
    pending: false,
    failed: false,
  });

  const toggleSection = (section: 'normal' | 'pending' | 'failed') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      inventory: '盘点数据',
      sales: '销售数据',
      replenishment: '补货单',
    };
    return labels[source] || source;
  };

  return (
    <div className="space-y-6">
      {result.isDuplicate && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">该批次已处理过，返回历史结果</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-gray-800">{result.summary.total}</div>
          <div className="text-sm text-gray-500">总计</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{result.summary.normal}</div>
          <div className="text-sm text-green-600">正常</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-orange-600">{result.summary.pending}</div>
          <div className="text-sm text-orange-600">待确认</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{result.summary.failed}</div>
          <div className="text-sm text-red-600">失败</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('normal')}
            className="w-full bg-green-50 px-4 py-3 flex items-center justify-between hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">
                正常项 ({result.data.normal.length})
              </span>
            </div>
            {expandedSections.normal ? (
              <ChevronUp className="w-5 h-5 text-green-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-green-600" />
            )}
          </button>
          {expandedSections.normal && (
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2 font-medium text-gray-600">SKU</th>
                    <th className="pb-2 font-medium text-gray-600">商品名称</th>
                    <th className="pb-2 font-medium text-gray-600">数量</th>
                    <th className="pb-2 font-medium text-gray-600">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.normal.map((item: NormalItem) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 font-mono">{item.sku}</td>
                      <td className="py-2">{item.skuName}</td>
                      <td className="py-2">{item.quantity}</td>
                      <td className="py-2">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {getSourceLabel(item.source)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border border-orange-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('pending')}
            className="w-full bg-orange-50 px-4 py-3 flex items-center justify-between hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-800">
                待确认项 ({result.data.pending.length})
              </span>
            </div>
            {expandedSections.pending ? (
              <ChevronUp className="w-5 h-5 text-orange-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-orange-600" />
            )}
          </button>
          {expandedSections.pending && (
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2 font-medium text-gray-600">SKU</th>
                    <th className="pb-2 font-medium text-gray-600">商品名称</th>
                    <th className="pb-2 font-medium text-gray-600">数量</th>
                    <th className="pb-2 font-medium text-gray-600">来源</th>
                    <th className="pb-2 font-medium text-gray-600">原因</th>
                    <th className="pb-2 font-medium text-gray-600">置信度</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.pending.map((item: PendingItem) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 font-mono">{item.sku}</td>
                      <td className="py-2">{item.skuName}</td>
                      <td className="py-2">{item.quantity}</td>
                      <td className="py-2">
                        <span className="bg-orange-100 px-2 py-1 rounded text-xs text-orange-700">
                          {getSourceLabel(item.source)}
                        </span>
                      </td>
                      <td className="py-2 text-orange-700 max-w-xs">{item.reason}</td>
                      <td className="py-2">{(item.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('failed')}
            className="w-full bg-red-50 px-4 py-3 flex items-center justify-between hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800">
                失败项 ({result.data.failed.length})
              </span>
            </div>
            {expandedSections.failed ? (
              <ChevronUp className="w-5 h-5 text-red-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-red-600" />
            )}
          </button>
          {expandedSections.failed && (
            <div className="p-4 space-y-4">
              {result.data.failed.map((item: FailedItem) => (
                <div
                  key={item.id}
                  className="bg-red-50 rounded-lg p-4 border border-red-100"
                >
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-red-600 font-medium mb-1">错误类型</div>
                      <div className="text-sm font-mono">{item.errorType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-red-600 font-medium mb-1">来源</div>
                      <span className="bg-red-100 px-2 py-1 rounded text-xs text-red-700">
                        {getSourceLabel(item.source)}
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs text-red-600 font-medium mb-1">错误信息</div>
                    <div className="text-sm text-red-800">{item.errorMessage}</div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs text-red-600 font-medium mb-1">处理建议</div>
                    <div className="text-sm text-red-700 bg-white p-2 rounded">
                      {item.suggestion}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-red-600 font-medium mb-1">原始数据</div>
                    <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                      {JSON.stringify(item.originalData, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
