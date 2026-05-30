import { Panel } from './ui/Panel';
import { Slider } from './ui/Slider';
import { Truck, Eye, EyeOff } from 'lucide-react';
import { useBridgeStore } from '@/store/useBridgeStore';
import { cn } from '@/lib/utils';

export function LoadPanel() {
  const load = useBridgeStore(state => state.load);
  const setLoad = useBridgeStore(state => state.setLoad);

  return (
    <Panel title="车辆荷载" className="w-72">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <span className="text-sm text-zinc-300">荷载可视化</span>
          </div>
          <button
            onClick={() => setLoad({ isVisible: !load.isVisible })}
            className={cn(
              'p-2 rounded border transition-colors',
              load.isVisible
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'border-zinc-600 text-zinc-400'
            )}
          >
            {load.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
        
        <Slider
          label="荷载大小"
          value={load.magnitude}
          min={0}
          max={100}
          step={1}
          onChange={(v) => setLoad({ magnitude: v })}
          unit="吨"
        />
        
        <Slider
          label="纵向位置"
          value={load.position}
          min={0}
          max={100}
          step={1}
          onChange={(v) => setLoad({ position: v })}
          unit="%"
        />
        
        <div>
          <span className="text-xs text-zinc-400 block mb-2">车道位置</span>
          <div className="flex gap-2">
            {[0, 1, 2].map(lane => (
              <button
                key={lane}
                onClick={() => setLoad({ lane })}
                className={cn(
                  'flex-1 py-2 rounded border text-sm transition-colors',
                  load.lane === lane
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                )}
              >
                {lane === 0 ? '左车道' : lane === 1 ? '中车道' : '右车道'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="text-xs text-zinc-500 mb-2">当前荷载参数</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-zinc-500">重量:</span>
              <span className="text-orange-400 font-mono ml-2">{load.magnitude}t</span>
            </div>
            <div>
              <span className="text-zinc-500">位置:</span>
              <span className="text-orange-400 font-mono ml-2">{load.position}%</span>
            </div>
            <div className="col-span-2">
              <span className="text-zinc-500">车道:</span>
              <span className="text-orange-400 font-mono ml-2">
                {load.lane === 0 ? '左车道' : load.lane === 1 ? '中车道' : '右车道'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
