import React from 'react';
import { FilterFailureInfo } from '../../types/filter';
import { GlassCard } from '../common/GlassCard';
import { GlowButton } from '../common/GlowButton';

interface FilterWarningProps {
  failureInfo: FilterFailureInfo;
  onResetFilter: () => void;
  onAdjustThreshold: () => void;
}

export const FilterWarning: React.FC<FilterWarningProps> = ({
  failureInfo,
  onResetFilter,
  onAdjustThreshold,
}) => {
  if (!failureInfo.failed) {
    return null;
  }

  const getWarningContent = () => {
    if (failureInfo.count === 0) {
      return {
        icon: '🔍',
        title: '筛选无结果',
        description: '当前筛选条件没有匹配到任何作品。',
      };
    } else if (failureInfo.count < failureInfo.minCount) {
      return {
        icon: '📊',
        title: '筛选结果过少',
        description: `仅匹配到 ${failureInfo.count} 个作品，无法进行有效的聚类比较。`,
      };
    } else {
      return {
        icon: '⚠️',
        title: '筛选异常',
        description: '筛选条件可能导致分析结果不准确。',
      };
    }
  };

  const content = getWarningContent();

  return (
    <GlassCard className="p-4 bg-orange-500/10 border border-orange-500/30">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{content.icon}</span>
        <div className="flex-1">
          <h4 className="font-bold text-orange-400">{content.title}</h4>
          <p className="text-sm text-gray-300 mt-1">{content.description}</p>
          <p className="text-xs text-gray-400 mt-2">
            建议：{failureInfo.suggestions.join('；')}
          </p>

          <div className="flex gap-2 mt-3">
            <GlowButton variant="primary" size="sm" onClick={onResetFilter}>
              重置筛选
            </GlowButton>
            <GlowButton variant="secondary" size="sm" onClick={onAdjustThreshold}>
              调整阈值
            </GlowButton>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
