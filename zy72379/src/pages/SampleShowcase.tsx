import React from 'react';
import { CheckCircle, AlertOctagon, FileText, ArrowRight, Camera, Edit3, Link as LinkIcon } from 'lucide-react';
import { sampleRecords } from '@/data/sampleRecords';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Timeline } from '@/components/common/Timeline';
import type { SampleRecord } from '@/types';

const SampleShowcase: React.FC = () => {
  const getCardStyle = (type: string) => {
    switch (type) {
      case 'normal':
        return 'border-success-300 bg-success-50/30';
      case 'over_threshold':
        return 'border-warning-300 bg-warning-50/30';
      case 'supplemented':
        return 'border-info-300 bg-info-50/30';
      default:
        return 'border-neutral-300';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'normal':
        return <CheckCircle className="w-6 h-6 text-success-600" />;
      case 'over_threshold':
        return <AlertOctagon className="w-6 h-6 text-warning-600" />;
      case 'supplemented':
        return <FileText className="w-6 h-6 text-info-600" />;
      default:
        return <CheckCircle className="w-6 h-6 text-neutral-600" />;
    }
  };

  const getTimelineItems = (sample: SampleRecord) => {
    return sample.processingSteps.map((step, index) => ({
      id: `step-${index}`,
      title: step.title,
      time: step.description,
      icon: step.type === 'photo' ? <Camera className="w-4 h-4" /> :
            step.type === 'note' ? <Edit3 className="w-4 h-4" /> :
            <LinkIcon className="w-4 h-4" />,
      color: step.type === 'photo' ? 'bg-primary-500' :
             step.type === 'note' ? 'bg-success-500' :
             'bg-info-500',
      operator: '',
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">样例展示</h1>
        <p className="text-neutral-500 mt-1">
          展示三种典型处理结果：顺利记录、超阈值被平均值覆盖、从手写巡检备注补来的旧口径
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {sampleRecords.map((sample) => (
          <div
            key={sample.id}
            className={`bg-white border rounded-xl overflow-hidden ${getCardStyle(sample.type)}`}
          >
            <div className="px-6 py-4 border-b border-inherit bg-white/50">
              <div className="flex items-center gap-3 mb-3">
                {getIcon(sample.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg text-neutral-900">{sample.title}</h2>
                    <StatusBadge status={sample.record.recordStatus} type="record" size="sm" />
                  </div>
                  <p className="text-sm text-neutral-500">{sample.description}</p>
                </div>
              </div>
              <div className="text-xs text-neutral-500">
                记录ID：<span className="font-mono">{sample.record.id}</span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <div className="text-xs text-neutral-500 mb-1">材料</div>
                  <div className="font-medium text-neutral-900">{sample.record.materialName}</div>
                  <div className="text-xs text-neutral-500">{sample.record.materialType}</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-neutral-200">
                  <div className="text-xs text-neutral-500 mb-1">口径来源</div>
                  <div className="text-sm text-neutral-700">{sample.record.caliberSource}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-neutral-100 rounded-lg text-center">
                  <div className="text-xs text-neutral-500 mb-1">原始值</div>
                  <div className="font-mono text-2xl font-bold text-neutral-800">
                    {sample.record.originalValue}
                    <span className="text-sm text-neutral-500">{sample.record.originalUnit}</span>
                  </div>
                </div>
                <div className="p-4 bg-primary-100 rounded-lg text-center">
                  <div className="text-xs text-primary-600 mb-1">清洗后</div>
                  <div className="font-mono text-2xl font-bold text-primary-700">
                    {sample.record.cleanedValue}
                    <span className="text-sm text-primary-500">{sample.record.cleanedUnit}</span>
                  </div>
                </div>
              </div>

              {sample.unitConversion && (
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="text-sm font-medium text-primary-800 mb-2">单位换算说明</div>
                  <div className="text-sm text-primary-700 space-y-1">
                    <p>{sample.unitConversion.formula}</p>
                    <p className="text-xs text-primary-600">
                      使用口径：{sample.unitConversion.caliberVersion}
                    </p>
                    {sample.unitConversion.historyMatch && (
                      <p className="text-xs text-success-600">
                        ✓ 与历史记录口径一致
                      </p>
                    )}
                    {sample.unitConversion.historyMismatch && (
                      <p className="text-xs text-warning-600">
                        ⚠ {sample.unitConversion.historyMismatch}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-neutral-900 mb-3">证据来源</div>
                <div className="flex gap-2">
                  {sample.record.evidenceSources.includes('photo') && (
                    <span className="flex items-center gap-1 px-3 py-1.5 bg-primary-100 text-primary-700 text-sm font-medium rounded-lg">
                      <Camera className="w-4 h-4" />
                      工况照片
                    </span>
                  )}
                  {sample.record.evidenceSources.includes('note') && (
                    <span className="flex items-center gap-1 px-3 py-1.5 bg-success-100 text-success-700 text-sm font-medium rounded-lg">
                      <Edit3 className="w-4 h-4" />
                      手写备注
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-neutral-900 mb-3">处理步骤</div>
                <Timeline items={getTimelineItems(sample)} />
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
                <div className="text-sm font-medium text-neutral-900 mb-2">最终结论</div>
                <p className="text-sm text-neutral-700">{sample.conclusion}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-white border border-neutral-200 rounded-xl">
        <h2 className="font-bold text-lg text-neutral-900 mb-4">三种处理结果对比</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">对比项</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-success-700 bg-success-50/50">顺利记录</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-warning-700 bg-warning-50/50">超阈值覆盖</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-info-700 bg-info-50/50">补录旧口径</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-neutral-700">数据来源</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-success-50/30">工况照片</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-warning-50/30">工况照片 + 平均值计算</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-info-50/30">手写巡检备注</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-neutral-700">单位换算</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-success-50/30">最新口径，与历史一致</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-warning-50/30">最新口径，与历史一致</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-info-50/30">2023旧口径，与历史记录匹配</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-neutral-700">阈值处理</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-success-50/30">正常范围内</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-warning-50/30">超阈值，被相邻点平均值覆盖</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-info-50/30">正常范围内</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-neutral-700">状态标记</td>
                <td className="px-4 py-3 text-sm bg-success-50/30"><StatusBadge status="normal" type="record" size="sm" /></td>
                <td className="px-4 py-3 text-sm bg-warning-50/30"><StatusBadge status="pending_review" type="record" size="sm" /></td>
                <td className="px-4 py-3 text-sm bg-info-50/30"><StatusBadge status="supplemented" type="record" size="sm" /></td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-neutral-700">是否需人工复核</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-success-50/30">否</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-warning-50/30">是，维修师傅复核</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-info-50/30">否，但保留补录标记</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-neutral-700">证据链完整性</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-success-50/30">完整，2个节点</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-warning-50/30">完整，4个节点（含清洗+复核）</td>
                <td className="px-4 py-3 text-sm text-neutral-600 bg-info-50/30">完整，3个节点（含补录标记）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 bg-primary-50 border border-primary-200 rounded-xl">
        <h2 className="font-bold text-lg text-primary-900 mb-3">测试建议</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success-600" />
              <span className="font-medium text-primary-800">正常材料测试</span>
            </div>
            <p className="text-sm text-primary-700">
              导入工况照片，确认单位换算说明与历史记录一致，状态显示"顺利"。
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-warning-600" />
              <span className="font-medium text-primary-800">错口径材料测试</span>
            </div>
            <p className="text-sm text-primary-700">
              导入旧口径数据，查看单位换算说明中的历史口径对比，确认能检测口径不一致。
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-info-600" />
              <span className="font-medium text-primary-800">补录材料测试</span>
            </div>
            <p className="text-sm text-primary-700">
              林老师补看手写巡检备注，从备注补录旧口径数据，确认口径来源显示正确。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SampleShowcase;
