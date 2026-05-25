import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useEffect, useRef } from 'react';

export const Timeline = () => {
  const excavationData = useStore((state) => state.excavationData);
  const timeline = useStore((state) => state.timeline);
  const setTimelinePlaying = useStore((state) => state.setTimelinePlaying);
  const setTimelinePeriodIndex = useStore((state) => state.setTimelinePeriodIndex);
  const setTimelineSpeed = useStore((state) => state.setTimelineSpeed);
  const setLayerVisibility = useStore((state) => state.setLayerVisibility);

  const animationRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  const uniquePeriods = excavationData
    ? [...new Set(excavationData.layers.map((l) => l.period))]
    : [];

  useEffect(() => {
    if (!timeline.isPlaying || !excavationData) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const maxDepth = excavationData.gridSize.z;

    const animate = () => {
      progressRef.current += 0.002 * timeline.speed;

      if (progressRef.current >= 1) {
        progressRef.current = 0;
      }

      const currentDepth = progressRef.current * maxDepth;

      excavationData.layers.forEach((layer) => {
        const layerMidDepth = (layer.depthTop + layer.depthBottom) / 2;
        const isVisible = layerMidDepth <= currentDepth;
        setLayerVisibility(layer.id, isVisible);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    timeline.isPlaying,
    timeline.speed,
    excavationData,
    setLayerVisibility,
  ]);

  const handleTogglePlay = () => {
    if (!timeline.isPlaying) {
      progressRef.current = 0;
    }
    setTimelinePlaying(!timeline.isPlaying);
  };

  const handleReset = () => {
    setTimelinePlaying(false);
    progressRef.current = 0;
    if (excavationData) {
      excavationData.layers.forEach((layer) => {
        setLayerVisibility(layer.id, true);
      });
    }
  };

  const handleStepForward = () => {
    if (uniquePeriods.length > 0) {
      const nextIndex = (timeline.currentPeriodIndex + 1) % uniquePeriods.length;
      setTimelinePeriodIndex(nextIndex);
      updateLayersForPeriod(uniquePeriods[nextIndex]);
    }
  };

  const handleStepBackward = () => {
    if (uniquePeriods.length > 0) {
      const prevIndex =
        timeline.currentPeriodIndex === 0
          ? uniquePeriods.length - 1
          : timeline.currentPeriodIndex - 1;
      setTimelinePeriodIndex(prevIndex);
      updateLayersForPeriod(uniquePeriods[prevIndex]);
    }
  };

  const updateLayersForPeriod = (targetPeriod: string) => {
    if (!excavationData) return;
    const periodIndex = uniquePeriods.indexOf(targetPeriod);

    excavationData.layers.forEach((layer) => {
      const layerPeriodIndex = uniquePeriods.indexOf(layer.period);
      setLayerVisibility(layer.id, layerPeriodIndex <= periodIndex);
    });
  };

  if (!excavationData) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[500px] bg-stone-900/95 backdrop-blur border border-stone-700 rounded-xl shadow-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-stone-200 flex items-center gap-2">
          <Gauge size={16} className="text-amber-500" />
          年代时间轴
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400">速度:</span>
          <select
            value={timeline.speed}
            onChange={(e) => setTimelineSpeed(Number(e.target.value))}
            className="bg-stone-800 text-stone-200 text-xs px-2 py-1 rounded border border-stone-600"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={handleReset}
          className="p-2 rounded hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
          title="重置"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={handleStepBackward}
          className="p-2 rounded hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
          title="上一时期"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={handleTogglePlay}
          className="p-3 rounded-full bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          title={timeline.isPlaying ? '暂停' : '播放'}
        >
          {timeline.isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={handleStepForward}
          className="p-2 rounded hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
          title="下一时期"
        >
          <SkipForward size={16} />
        </button>
        <button
          onClick={handleReset}
          className="p-2 rounded hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
          title="重置"
        >
          <SkipForward size={16} />
        </button>
      </div>

      <div className="flex gap-1">
        {uniquePeriods.map((period, index) => (
          <button
            key={period}
            onClick={() => {
              setTimelinePeriodIndex(index);
              updateLayersForPeriod(period);
            }}
            className={`flex-1 px-2 py-1.5 text-xs rounded transition-all ${
              index <= timeline.currentPeriodIndex
                ? 'bg-amber-600 text-white'
                : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      <p className="text-xs text-stone-500 text-center mt-2">
        {timeline.isPlaying
          ? '正在播放地层堆积动画...'
          : '点击播放查看地层堆积过程，或点击年代标签快速切换'}
      </p>
    </div>
  );
};
