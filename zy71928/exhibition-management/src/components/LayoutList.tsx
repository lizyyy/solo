import React, { useState } from 'react';
import { FileText, Download, AlertTriangle, CheckCircle, Printer } from 'lucide-react';
import { Exhibition, User, LayoutList as LayoutListType } from '@/types';
import { generateLayoutList } from '@/utils/flashLoanJudgment';
import { StatusBadge } from './StatusBadge';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface LayoutListProps {
  exhibition: Exhibition;
  currentUser: User;
}

export const LayoutList: React.FC<LayoutListProps> = ({ exhibition, currentUser }) => {
  const [generatedList, setGeneratedList] = useState<LayoutListType | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleGenerate = () => {
    const result = generateLayoutList(exhibition, currentUser);
    setGeneratedList(result.layoutList);
    setWarnings(result.warnings);
  };

  const activeArtworks = exhibition.artworks.filter(a => a.status !== 'replaced');
  const hasUnconfirmedAnomalies = exhibition.anomalies.some(a => !a.confirmed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-blue-600" />
          布展清单
        </h2>
        <div className="flex gap-3">
          {currentUser.role === 'assistant' && (
            <button
              onClick={handleGenerate}
              className="btn btn-primary"
            >
              <Download size={16} className="mr-1" />
              生成清单
            </button>
          )}
          {generatedList && (
            <button className="btn btn-secondary">
              <Printer size={16} className="mr-1" />
              打印
            </button>
          )}
        </div>
      </div>

      {hasUnconfirmedAnomalies && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h4 className="font-medium text-yellow-800">重要提示</h4>
            <p className="text-sm text-yellow-700 mt-1">
              当前存在未确认的异常。生成的清单将标记有异常的作品为"待确认"状态，
              不会混入正常结果中。请先处理所有异常后再最终确认清单。
            </p>
          </div>
        </div>
      )}

      {!generatedList ? (
        <div className="card p-12 text-center">
          <FileText className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-lg font-medium text-gray-700 mb-2">布展清单</h3>
          <p className="text-gray-500 mb-4">
            当前展示 {activeArtworks.length} 件作品的预览信息
          </p>
          {currentUser.role === 'assistant' && (
            <button
              onClick={handleGenerate}
              className="btn btn-primary"
            >
              生成正式清单
            </button>
          )}
          
          <div className="mt-8 text-left">
            <h4 className="text-sm font-medium text-gray-700 mb-3">作品预览</h4>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">序号</th>
                  <th className="text-left px-3 py-2">作品</th>
                  <th className="text-left px-3 py-2">艺术家</th>
                  <th className="text-left px-3 py-2">尺寸</th>
                  <th className="text-left px-3 py-2">位置</th>
                  <th className="text-left px-3 py-2">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeArtworks.map((artwork, index) => (
                  <tr key={artwork.id} className={artwork.status === 'pending_confirmation' ? 'bg-yellow-50' : ''}>
                    <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{artwork.title}</td>
                    <td className="px-3 py-2 text-gray-600">{artwork.artist}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {artwork.width} × {artwork.height} {artwork.unit}
                      {!artwork.unitConfirmed && (
                        <span className="ml-2 text-xs text-red-500">*</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{artwork.location}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={artwork.status}>
                        {artwork.status === 'normal' ? '正常' : '待确认'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between bg-white">
            <div>
              <h3 className="font-semibold text-gray-800">
                {exhibition.name} - 布展清单
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                版本号: {generatedList.version} · 
                生成时间: {format(new Date(generatedList.generatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })} · 
                生成人: {currentUser.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {generatedList.hasAnomalies && (
                <span className="status-badge status-warning">
                  有 {generatedList.anomalyCount} 项异常
                </span>
              )}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="bg-yellow-50 border-b border-yellow-200 p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
                <AlertTriangle size={16} />
                生成警告
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span>•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-6">
            <div className="border-2 border-gray-200 rounded-lg p-6 bg-white">
              <div className="text-center mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">{exhibition.name}</h2>
                <p className="text-gray-500 mt-1">
                  {format(new Date(exhibition.startDate), 'yyyy年MM月dd日', { locale: zhCN })} - {format(new Date(exhibition.endDate), 'yyyy年MM月dd日', { locale: zhCN })}
                </p>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-2 font-bold text-gray-700">序号</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">作品名称</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">艺术家</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">尺寸</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">展位</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedList.artworks.map((item: any) => (
                    <tr key={item.artworkId} className={`border-b border-gray-100 ${
                      item.status === 'pending_confirmation' ? 'bg-yellow-50' : ''
                    }`}>
                      <td className="py-3 px-2 text-gray-500">{item.sequence}</td>
                      <td className="py-3 px-2 font-medium text-gray-800">{item.title}</td>
                      <td className="py-3 px-2 text-gray-600">{item.artist}</td>
                      <td className="py-3 px-2 text-gray-600">{item.dimensions}</td>
                      <td className="py-3 px-2 text-gray-600">{item.location}</td>
                      <td className="py-3 px-2">
                        {item.status === 'pending_confirmation' ? (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            待确认
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            正常
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} />
                  <span>总计 {generatedList.artworks.length} 件作品</span>
                </div>
                <div>
                  {generatedList.pendingConfirmationCount > 0 && (
                    <span className="text-yellow-600">
                      其中 {generatedList.pendingConfirmationCount} 件待确认
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setGeneratedList(null)}
                className="btn btn-secondary"
              >
                返回预览
              </button>
              <button className="btn btn-primary">
                <Printer size={16} className="mr-1" />
                打印清单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
