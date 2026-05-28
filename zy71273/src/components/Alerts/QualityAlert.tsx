import React, { useState } from 'react';
import { QualityFlags } from '../../types/artwork';
import { GlassCard } from '../common/GlassCard';
import { GlowButton } from '../common/GlowButton';

interface QualityAlertProps {
  flags: QualityFlags;
  artworkTitle: string;
  onDismiss?: () => void;
}

export const QualityAlert: React.FC<QualityAlertProps> = ({
  flags,
  artworkTitle,
  onDismiss,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const alerts = [
    {
      key: 'transparentBgRisk',
      active: flags.transparentBgRisk,
      type: 'warning' as const,
      title: '透明背景误采警告',
      description: `作品"${artworkTitle}"的颜色采样可能包含透明背景像素，导致饱和度偏低、明度偏高。`,
      suggestion: '建议重新采样时选择有颜色的区域，或使用背景去除工具预处理图片。',
      icon: '⚠️',
    },
    {
      key: 'extremeColorRisk',
      active: flags.extremeColorRisk,
      type: 'danger' as const,
      title: '极端颜色检测',
      description: `作品"${artworkTitle}"的颜色处于色彩空间边界（过暗、过亮或过饱和）。`,
      suggestion: '在3D视图中可能被空间边缘遮挡，建议调整聚类阈值或使用高亮模式查看。',
      icon: '🔴',
    },
    {
      key: 'missingData',
      active: flags.missingData,
      type: 'danger' as const,
      title: '数据缺失警告',
      description: `作品"${artworkTitle}"缺少必要的色彩数据或班级标签。`,
      suggestion: '请补充完整的HSL数据和班级信息，否则无法参与聚类分析。',
      icon: '❌',
    },
    {
      key: 'versionConflict',
      active: flags.versionConflict,
      type: 'warning' as const,
      title: '版本冲突检测',
      description: `作品"${artworkTitle}"存在多个版本数据，当前显示的是最新版本。`,
      suggestion: '请查看版本历史确认数据准确性，必要时可回滚到历史版本。',
      icon: '🔄',
    },
  ];

  const activeAlerts = alerts.filter((a) => a.active);

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {activeAlerts.map((alert) => (
        <GlassCard
          key={alert.key}
          className={`p-4 border-l-4 ${
            alert.type === 'danger'
              ? 'border-left-red-500 bg-red-500/10'
              : 'border-left-yellow-500 bg-yellow-500/10'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{alert.icon}</span>
            <div className="flex-1">
              <h4
                className={`font-bold ${
                  alert.type === 'danger' ? 'text-red-400' : 'text-yellow-400'
                }`}
              >
                {alert.title}
              </h4>
              <p className="text-sm text-gray-300 mt-1">{alert.description}</p>

              {showDetails && (
                <div className="mt-3 p-3 bg-black/30 rounded-lg">
                  <p className="text-sm text-cyan-300">
                    <span className="font-semibold">建议：</span>
                    {alert.suggestion}
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <GlowButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? '隐藏详情' : '查看详情'}
                </GlowButton>
                {onDismiss && (
                  <GlowButton variant="ghost" size="sm" onClick={onDismiss}>
                    忽略
                  </GlowButton>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
};
