import { X, Palette, Layers, Hash, Calendar, Tag, AlertCircle, Info, RefreshCw, ZoomIn } from 'lucide-react';
import { Artwork, QualityReport } from '../../types/artwork';
import { GlassCard } from '../common/GlassCard';
import { GlowButton } from '../common/GlowButton';
import { ImagePreview } from './ImagePreview';
import { VersionHistory } from './VersionHistory';
import { hslToCssString } from '../../utils/hslCalculator';
import { useArtworkStore } from '../../store/useArtworkStore';

interface ArtworkDetailProps {
  artwork: Artwork;
  alerts: QualityReport[];
  onClose: () => void;
}

const alertTypeConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  transparent_bg: { 
    icon: AlertCircle, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/10',
    label: '透明背景误采'
  },
  extreme_color: { 
    icon: Info, 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/10',
    label: '极端颜色'
  },
  missing_data: { 
    icon: AlertCircle, 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/10',
    label: '数据缺失'
  },
  version_conflict: { 
    icon: Info, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/10',
    label: '版本冲突'
  }
};

export function ArtworkDetail({ artwork, alerts, onClose }: ArtworkDetailProps) {
  const focusAlert = useArtworkStore(state => state.focusAlert);

  const mainColor = artwork.hue !== null && artwork.saturation !== null && artwork.lightness !== null
    ? hslToCssString(artwork.hue, artwork.saturation, artwork.lightness)
    : '#6b7280';

  const handleAlertClick = (alert: QualityReport) => {
    focusAlert(alert.id);
  };

  const handleResample = () => {
    alert('排除透明区域重新采样功能将在后续版本支持');
  };

  const handleZoomEdge = () => {
    alert('边缘区域放大视图功能将在后续版本支持');
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            {artwork.title}
          </h2>
          <p className="text-sm text-white/60 mt-1 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" />
            {artwork.className}
          </p>
        </div>
        <GlowButton variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </GlowButton>
      </div>

      <ImagePreview artwork={artwork} />

      {alerts.length > 0 && (
        <GlassCard className="p-4 space-y-2">
          <h3 className="text-sm font-medium text-white/90 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            质量警报 ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.map(alert => {
              const config = alertTypeConfig[alert.alertType] || alertTypeConfig.missing_data;
              const Icon = config.icon;
              return (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-xl ${config.bgColor} border border-white/5 cursor-pointer hover:border-white/20 transition-all`}
                  onClick={() => handleAlertClick(alert)}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 ${config.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          alert.severity === 'error' ? 'bg-red-500/20 text-red-400' :
                          alert.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {alert.severity === 'error' ? '错误' : alert.severity === 'warning' ? '警告' : '提示'}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mt-1">{alert.description}</p>
                      
                      {alert.alertType === 'transparent_bg' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleResample(); }}
                          className="mt-2 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          排除透明区域重采样
                        </button>
                      )}
                      
                      {alert.alertType === 'extreme_color' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleZoomEdge(); }}
                          className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <ZoomIn className="w-3 h-3" />
                          边缘区域放大视图
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <h3 className="text-sm font-medium text-white/90 flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-indigo-400" />
          色彩数据
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white/5 rounded-xl">
            <div className="text-xs text-white/50 mb-1">色相 H</div>
            <div className="text-lg font-semibold text-white">
              {artwork.hue?.toFixed(0) ?? '—'}
              <span className="text-xs text-white/50 ml-1">°</span>
            </div>
            <div 
              className="h-1 rounded-full mt-2"
              style={{ 
                backgroundColor: artwork.hue !== null 
                  ? hslToCssString(artwork.hue, 100, 50) 
                  : '#374151' 
              }}
            />
          </div>
          
          <div className="text-center p-3 bg-white/5 rounded-xl">
            <div className="text-xs text-white/50 mb-1">明度 L</div>
            <div className="text-lg font-semibold text-white">
              {artwork.lightness?.toFixed(0) ?? '—'}
              <span className="text-xs text-white/50 ml-1">%</span>
            </div>
            <div className="h-1 rounded-full mt-2 bg-gradient-to-r from-black to-white" />
          </div>
          
          <div className="text-center p-3 bg-white/5 rounded-xl">
            <div className="text-xs text-white/50 mb-1">饱和度 S</div>
            <div className="text-lg font-semibold text-white">
              {artwork.saturation?.toFixed(0) ?? '—'}
              <span className="text-xs text-white/50 ml-1">%</span>
            </div>
            <div 
              className="h-1 rounded-full mt-2"
              style={{ 
                background: `linear-gradient(to right, #808080, ${artwork.hue !== null ? hslToCssString(artwork.hue, 100, 50) : '#808080'})`
              }}
            />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl border border-white/10" style={{ backgroundColor: mainColor + '20' }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg border-2 border-white/20 flex-shrink-0"
              style={{ backgroundColor: mainColor }}
            />
            <div>
              <div className="text-xs text-white/50">主色调</div>
              <div className="text-sm text-white font-mono">{mainColor}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-white/50">评分</div>
              <div className="text-lg font-bold text-amber-400">{artwork.score}</div>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
            <Hash className="w-3.5 h-3.5" />
            数据版本
          </div>
          <div className="text-white font-mono text-sm">{artwork.dataVersion}</div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
            <Calendar className="w-3.5 h-3.5" />
            采样时间
          </div>
          <div className="text-white text-sm">
            {new Date(artwork.sampledAt).toLocaleDateString('zh-CN')}
          </div>
        </GlassCard>
      </div>

      {artwork.notes && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
            <Layers className="w-3.5 h-3.5" />
            备注
          </div>
          <p className="text-white/80 text-sm">{artwork.notes}</p>
        </GlassCard>
      )}

      <VersionHistory artwork={artwork} />

      <div className="mt-auto pt-4">
        <GlowButton 
          variant="primary" 
          className="w-full"
          onClick={() => alert('添加到报告功能将在后续版本支持')}
        >
          <Layers className="w-4 h-4" />
          添加到评审报告
        </GlowButton>
      </div>
    </div>
  );
}
