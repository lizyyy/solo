import { HelpCircle, Cloud, MapPin, FileCheck } from 'lucide-react';
import { guideContent } from '../data/mockData';

const sections = [
  {
    id: 'weather',
    icon: Cloud,
    title: '气象截图放置规范',
    content: guideContent.weatherScreenshot,
    color: 'text-primary-600',
    bgColor: 'bg-primary-50',
    borderColor: 'border-primary-200',
  },
  {
    id: 'return',
    icon: MapPin,
    title: '返航点查看位置',
    content: guideContent.returnPoint,
    color: 'text-farm-600',
    bgColor: 'bg-farm-50',
    borderColor: 'border-farm-200',
  },
  {
    id: 'check',
    icon: FileCheck,
    title: '导出前复核流程',
    content: guideContent.reviewCheck,
    color: 'text-status-pending',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
];

export function Guide() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-mono-200 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="text-primary-600" size={24} />
            <h1 className="text-xl font-bold text-mono-800">操作指引</h1>
          </div>
          <p className="text-sm text-mono-500">
            外场队长收尾操作说明：气象截图放置、返航点查看、导出前复核
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div
              key={section.id}
              className={`border-2 ${section.borderColor} ${section.bgColor} p-6`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 ${section.bgColor} ${section.color} border ${section.borderColor} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-2xl font-bold">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <section.icon size={18} className={section.color} />
                    <h2 className={`text-lg font-bold ${section.color}`}>
                      {section.title}
                    </h2>
                  </div>
                  <div className="text-sm text-mono-700 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border border-mono-300 bg-mono-50 p-5 mt-8">
          <h3 className="font-bold text-mono-800 mb-3">快速索引</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-mono-700 mb-1">气象截图</p>
              <ul className="text-xs text-mono-500 space-y-1">
                <li>• 命名规则：日期_农田编号_天气.png</li>
                <li>• 必须包含系统时间戳</li>
                <li>• 飞行前1小时内上传</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-mono-700 mb-1">返航点状态</p>
              <ul className="text-xs text-mono-500 space-y-1">
                <li>• 总览页卡片右上角●图标</li>
                <li>• 详情页「飞行基本信息」区块</li>
                <li>• 异常时自动显示处理口径</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-mono-700 mb-1">导出复核</p>
              <ul className="text-xs text-mono-500 space-y-1">
                <li>• 4项检查必须全部勾选</li>
                <li>• 完成后导出按钮自动启用</li>
                <li>• 支持Excel和PDF两种格式</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-mono-200 pt-4 mt-8">
          <div className="text-center text-xs text-mono-400">
            <p>农田病虫航拍管理系统 v1.0 · 操作指引</p>
            <p className="mt-1">如有疑问，请联系项目负责人</p>
          </div>
        </div>
      </div>
    </div>
  );
}
