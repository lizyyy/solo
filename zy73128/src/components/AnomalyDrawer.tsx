import { useState } from 'react';
import {
  X,
  CloudFog,
  MapPin,
  AlertTriangle,
  FileSearch,
  Check,
  RotateCcw,
  Info,
} from 'lucide-react';
import type { Annotation, CloudMask } from '@/shared/types';
import { cn } from '@/lib/utils';

interface AnomalyDrawerProps {
  open: boolean;
  onClose: () => void;
  annotation: Annotation;
  onSaveCloudMask: (mask: CloudMask) => void;
  onJumpBadData: () => void;
  onRevise: () => void;
}

export default function AnomalyDrawer({
  open,
  onClose,
  annotation,
  onSaveCloudMask,
  onJumpBadData,
  onRevise,
}: AnomalyDrawerProps) {
  const [activeTab, setActiveTab] = useState<'cloud' | 'bad' | 'revise'>('cloud');
  const [affectedArea, setAffectedArea] = useState(
    annotation.cloudMask?.affectedArea.toFixed(2) ?? '2.15',
  );
  const [reviewSource, setReviewSource] = useState(
    annotation.cloudMask?.reviewSource ??
      'Sentinel-2A L2A 轨道号T50QMG 时间2026-06-01 已申请下载',
  );
  const [description, setDescription] = useState(
    annotation.cloudMask?.description ?? '',
  );

  const handleSaveCloud = () => {
    const mask: CloudMask = {
      id: annotation.cloudMask?.id ?? `CLOUD-${Date.now()}`,
      annotationId: annotation.id,
      polygon: annotation.cloudMask?.polygon ?? 'M 220,0 L 400,0 L 400,180 L 220,180 Z',
      affectedArea: parseFloat(affectedArea) || 0,
      reviewSource,
      description,
    };
    onSaveCloudMask(mask);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-ocean-900/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-ocean-800 z-50 shadow-2xl border-l border-ocean-600/40 flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ocean-600/40 bg-ocean-700/40">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-coral-400" />
            <h2 className="font-serif font-semibold text-ocean-50">异常标记与复核</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ocean-300 hover:bg-ocean-600/50 hover:text-ocean-50 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-ocean-600/30">
          {[
            { key: 'cloud', label: '云遮挡排除', icon: CloudFog },
            { key: 'bad', label: '坏数据回跳', icon: RotateCcw },
            { key: 'revise', label: '人工改判', icon: FileSearch },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={cn(
                'flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5 transition-all relative',
                activeTab === t.key
                  ? 'text-coral-300 bg-ocean-700/30'
                  : 'text-ocean-300 hover:text-ocean-100',
              )}
            >
              <t.icon size={13} />
              {t.label}
              {activeTab === t.key && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-coral-400 rounded-t" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'cloud' && (
            <>
              <div className="bg-status-cloud/10 border border-status-cloud/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-status-cloud font-medium text-sm mb-1">
                  <CloudFog size={15} />
                  云遮挡区域排除
                </div>
                <p className="text-[11px] text-ocean-300 leading-relaxed">
                  标记云遮挡区域后，系统将自动从白化汇总与统计中扣减该部分面积，
                  CSV 明细的「异常标记」列将写入 "云遮挡-已排除"。
                </p>
              </div>

              <div>
                <label className="text-[11px] text-ocean-300 mb-1.5 block">
                  影响面积 (km²)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={affectedArea}
                  onChange={(e) => setAffectedArea(e.target.value)}
                  className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-2 text-sm text-ocean-50 font-mono focus:outline-none focus:border-coral-400/60"
                />
              </div>

              <div>
                <label className="text-[11px] text-ocean-300 mb-1.5 block">
                  补看来源（数据源 + 轨道号 + 时间）
                </label>
                <textarea
                  value={reviewSource}
                  onChange={(e) => setReviewSource(e.target.value)}
                  rows={3}
                  className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-2 text-sm text-ocean-50 font-mono resize-none focus:outline-none focus:border-coral-400/60"
                  placeholder="例如：Sentinel-2A L2A 轨道号T50QMG 时间2026-06-01"
                />
              </div>

              <div>
                <label className="text-[11px] text-ocean-300 mb-1.5 block">
                  遮挡说明
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-2 text-sm text-ocean-50 resize-none focus:outline-none focus:border-coral-400/60"
                  placeholder="简述云遮挡位置、形状、对结果的影响程度..."
                />
              </div>

              <div className="bg-ocean-700/30 rounded-lg p-3 text-[11px] text-ocean-300 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-ocean-200">
                  <Info size={12} />
                  排除后自动计算
                </div>
                <div>原调查面积：{annotation.totalArea.toFixed(2)} km²</div>
                <div>云遮挡排除：{parseFloat(affectedArea || '0').toFixed(2)} km²</div>
                <div className="font-medium text-coral-300">
                  有效调查面积：{(annotation.totalArea - parseFloat(affectedArea || '0')).toFixed(2)} km²
                </div>
                <div>
                  修正白化率：{(
                    (annotation.bleachingArea /
                      (annotation.totalArea - parseFloat(affectedArea || '0'))) *
                    100
                  ).toFixed(2)}
                  %
                </div>
              </div>

              <button
                onClick={handleSaveCloud}
                className="w-full py-2.5 bg-status-cloud hover:bg-status-cloud/90 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2"
              >
                <Check size={15} />
                保存并标记为云遮挡
              </button>
            </>
          )}

          {activeTab === 'bad' && (
            <>
              <div className="bg-status-anomaly/10 border border-status-anomaly/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-status-anomaly font-medium text-sm mb-1">
                  <RotateCcw size={15} />
                  坏数据回跳原始对象
                </div>
                <p className="text-[11px] text-ocean-300 leading-relaxed">
                  当发现自动识别的坏数据（如砂质浅滩误判为健康珊瑚、云误判为白化），
                  可通过回跳功能回到遥感截图的原始像素位置，确认问题后发起人工改判。
                </p>
              </div>

              <div>
                <label className="text-[11px] text-ocean-300 mb-1.5 block">
                  坏数据锚点
                </label>
                <div className="bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-2 text-sm text-coral-300 font-mono">
                  {annotation.badDataRef ?? '尚未设置锚点'}
                </div>
              </div>

              {annotation.badDataRef && (
                <div className="bg-ocean-700/30 rounded-lg p-3 text-[11px] text-ocean-300">
                  <div className="font-medium text-ocean-200 mb-1">锚点解析</div>
                  <div className="font-mono space-y-0.5">
                    <div>格式：pixel: x1,y1-x2,y2</div>
                    <div>区域：{annotation.badDataRef.replace('pixel:', '')}</div>
                    <div>用途：定位初判错误的矩形区域</div>
                  </div>
                </div>
              )}

              <button
                onClick={onJumpBadData}
                disabled={!annotation.badDataRef}
                className={cn(
                  'w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
                  annotation.badDataRef
                    ? 'bg-coral-500 hover:bg-coral-600 text-white'
                    : 'bg-ocean-700/50 text-ocean-400 cursor-not-allowed',
                )}
              >
                <MapPin size={15} />
                回跳至遥感截图原始位置
              </button>

              <button
                onClick={onRevise}
                className="w-full py-2.5 bg-ocean-700 hover:bg-ocean-600 text-ocean-100 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 border border-ocean-500/30"
              >
                <FileSearch size={15} />
                前往人工改判面板
              </button>
            </>
          )}

          {activeTab === 'revise' && (
            <>
              <div className="bg-coral-500/10 border border-coral-400/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-coral-400 font-medium text-sm mb-1">
                  <FileSearch size={15} />
                  人工改判说明
                </div>
                <p className="text-[11px] text-ocean-300 leading-relaxed">
                  每次改判都会追加一条线索记录，原数据以快照形式永久保留，不会被覆盖。
                  接手同事可沿线索链追溯每一次结论变化的原因与证据。
                </p>
              </div>

              <div className="space-y-2">
                <div className="bg-ocean-700/30 rounded p-2.5 text-[11px]">
                  <div className="text-ocean-400 mb-1">当前等级</div>
                  <div className="text-ocean-100 font-medium">{annotation.severity}</div>
                </div>
                <div className="bg-ocean-700/30 rounded p-2.5 text-[11px]">
                  <div className="text-ocean-400 mb-1">当前白化面积</div>
                  <div className="text-ocean-100 font-mono">{annotation.bleachingArea.toFixed(2)} km²</div>
                </div>
                <div className="bg-ocean-700/30 rounded p-2.5 text-[11px]">
                  <div className="text-ocean-400 mb-1">已有改判记录</div>
                  <div className="text-ocean-100 font-mono">
                    {annotation.status === '异常' ? '是（异常记录）' : '否'}
                  </div>
                </div>
              </div>

              <div className="bg-ocean-800/60 border border-ocean-600/40 rounded-lg p-3">
                <div className="text-[11px] text-ocean-300 font-medium mb-2">改判操作流程</div>
                <ol className="text-[11px] text-ocean-200 space-y-1.5 list-decimal list-inside">
                  <li>在左侧三联编辑面板修改白化等级与面积</li>
                  <li>填写改判理由（保存后自动写入线索链）</li>
                  <li>标注截图锚点（像素坐标，用于回跳追溯）</li>
                  <li>点击「确认改判」完成，记录状态变为「异常」</li>
                </ol>
              </div>

              <button
                onClick={onRevise}
                className="w-full py-2.5 bg-coral-500 hover:bg-coral-600 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2"
              >
                <FileSearch size={15} />
                打开改判表单
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
