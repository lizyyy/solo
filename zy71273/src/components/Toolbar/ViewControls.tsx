import { RotateCcw, Grid3X3, Axis3D, Play, Pause, Layers } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { GlowButton } from '../common/GlowButton';
import { Tooltip } from '../common/Tooltip';
import { GlassCard } from '../common/GlassCard';

export function ViewControls() {
  const { settings, setAutoRotate, setShowGrid, setShowAxes, setClusterMode, resetView } = useSceneStore();

  return (
    <GlassCard className="p-3 flex flex-col gap-2">
      <Tooltip content={settings.autoRotate ? '暂停自动旋转' : '开始自动旋转'} position="left">
        <GlowButton 
          variant={settings.autoRotate ? 'primary' : 'secondary'} 
          size="md"
          onClick={() => setAutoRotate(!settings.autoRotate)}
          active={settings.autoRotate}
        >
          {settings.autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </GlowButton>
      </Tooltip>

      <Tooltip content={settings.showGrid ? '隐藏网格' : '显示网格'} position="left">
        <GlowButton 
          variant={settings.showGrid ? 'primary' : 'secondary'} 
          size="md"
          onClick={() => setShowGrid(!settings.showGrid)}
          active={settings.showGrid}
        >
          <Grid3X3 className="w-4 h-4" />
        </GlowButton>
      </Tooltip>

      <Tooltip content={settings.showAxes ? '隐藏坐标轴' : '显示坐标轴'} position="left">
        <GlowButton 
          variant={settings.showAxes ? 'primary' : 'secondary'} 
          size="md"
          onClick={() => setShowAxes(!settings.showAxes)}
          active={settings.showAxes}
        >
          <Axis3D className="w-4 h-4" />
        </GlowButton>
      </Tooltip>

      <div className="w-full h-px bg-white/10 my-1" />

      <Tooltip content="聚类模式：无" position="left">
        <GlowButton 
          variant={settings.clusterMode === 'none' ? 'primary' : 'secondary'} 
          size="md"
          onClick={() => setClusterMode('none')}
          active={settings.clusterMode === 'none'}
        >
          <div className="w-4 h-4 rounded-full border-2 border-current" />
        </GlowButton>
      </Tooltip>

      <Tooltip content="聚类模式：按班级" position="left">
        <GlowButton 
          variant={settings.clusterMode === 'class' ? 'primary' : 'secondary'} 
          size="md"
          onClick={() => setClusterMode('class')}
          active={settings.clusterMode === 'class'}
        >
          <Layers className="w-4 h-4" />
        </GlowButton>
      </Tooltip>

      <Tooltip content="聚类模式：按色彩" position="left">
        <GlowButton 
          variant={settings.clusterMode === 'color' ? 'primary' : 'secondary'} 
          size="md"
          onClick={() => setClusterMode('color')}
          active={settings.clusterMode === 'color'}
        >
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 via-green-500 to-blue-500" />
        </GlowButton>
      </Tooltip>

      <div className="w-full h-px bg-white/10 my-1" />

      <Tooltip content="重置视角" position="left">
        <GlowButton 
          variant="secondary" 
          size="md"
          onClick={resetView}
        >
          <RotateCcw className="w-4 h-4" />
        </GlowButton>
      </Tooltip>
    </GlassCard>
  );
}
