import { useState, useMemo } from 'react';
import { GitCompare, Plus, Trash2, ArrowUp, ArrowDown, Minus, ChevronDown } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { toDegrees } from '@/utils/swingMath';

interface CompareItem {
  frameIndex: number;
  label: string;
  color: string;
}

const COMPARE_COLORS = [
  { hex: '#00FF88', class: 'golf-green' },
  { hex: '#00AAFF', class: 'golf-blue' },
  { hex: '#FF8800', class: 'golf-orange' },
  { hex: '#AA66FF', class: 'golf-purple' },
];

const PARAM_GROUPS = [
  { 
    key: 'position', 
    label: '位置坐标', 
    params: [
      { key: 'x', label: 'X', unit: 'm' },
      { key: 'y', label: 'Y', unit: 'm' },
      { key: 'z', label: 'Z', unit: 'm' },
    ]
  },
  { 
    key: 'faceAngle', 
    label: '杆面角度', 
    params: [
      { key: 'x', label: '横滚 X', unit: '°', isAngle: true },
      { key: 'y', label: '俯仰 Y', unit: '°', isAngle: true },
      { key: 'z', label: '偏航 Z', unit: '°', isAngle: true },
    ]
  },
  { 
    key: 'motion', 
    label: '运动参数', 
    params: [
      { key: 'velocity', label: '杆头速度', unit: 'm/s' },
      { key: 'acceleration', label: '加速度', unit: 'm/s²' },
    ]
  },
];

function DiffIndicator({ diff, threshold = 0.1 }: { diff: number; threshold?: number }) {
  if (Math.abs(diff) < threshold) {
    return (
      <span className="flex items-center gap-1 text-golf-text-muted">
        <Minus className="w-3 h-3" /> 一致
      </span>
    );
  }
  
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-golf-green">
        <ArrowUp className="w-3 h-3" /> +{diff.toFixed(2)}
      </span>
    );
  }
  
  return (
    <span className="flex items-center gap-1 text-golf-red">
      <ArrowDown className="w-3 h-3" /> {diff.toFixed(2)}
    </span>
  );
}

export function ComparisonPanel() {
  const { 
    currentSession, 
    activePanel,
    selectedFrameIndex,
    flyToFrame,
  } = useSwingStore();
  
  const [compareItems, setCompareItems] = useState<CompareItem[]>([
    { frameIndex: 0, label: '起杆', color: COMPARE_COLORS[0].hex },
    { frameIndex: 30, label: '上杆顶点', color: COMPARE_COLORS[1].hex },
  ]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['position', 'faceAngle', 'motion']);
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  if (!currentSession || activePanel !== 'compare') return null;
  
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };
  
  const addCompareItem = () => {
    if (compareItems.length >= 4) return;
    
    const newItem: CompareItem = {
      frameIndex: selectedFrameIndex,
      label: `帧 ${selectedFrameIndex}`,
      color: COMPARE_COLORS[compareItems.length % COMPARE_COLORS.length].hex,
    };
    
    setCompareItems([...compareItems, newItem]);
    setShowAddMenu(false);
  };
  
  const removeCompareItem = (index: number) => {
    setCompareItems(compareItems.filter((_, i) => i !== index));
  };
  
  const updateCompareItemLabel = (index: number, label: string) => {
    const updated = [...compareItems];
    updated[index].label = label;
    setCompareItems(updated);
  };
  
  const getParamValue = (frameIndex: number, groupKey: string, paramKey: string, isAngle: boolean = false) => {
    const frame = currentSession.frames[frameIndex];
    if (!frame) return 0;
    
    let value: number;
    if (groupKey === 'position') {
      value = frame.position[paramKey as keyof typeof frame.position];
    } else if (groupKey === 'faceAngle') {
      value = frame.faceAngle[paramKey as keyof typeof frame.faceAngle];
      if (isAngle) value = toDegrees(value);
    } else if (groupKey === 'motion') {
      value = paramKey === 'velocity' ? frame.velocity : frame.acceleration;
    } else {
      value = 0;
    }
    
    return value;
  };
  
  const comparisonData = useMemo(() => {
    if (compareItems.length < 2) return [];
    
    return PARAM_GROUPS.map(group => ({
      ...group,
      params: group.params.map(param => {
        const baseValue = getParamValue(compareItems[0].frameIndex, group.key, param.key, param.isAngle);
        const comparisons = compareItems.slice(1).map((item, idx) => {
          const value = getParamValue(item.frameIndex, group.key, param.key, param.isAngle);
          return {
            itemIndex: idx + 1,
            value,
            diff: value - baseValue,
          };
        });
        
        return {
          ...param,
          baseValue,
          comparisons,
        };
      }),
    }));
  }, [compareItems, currentSession]);
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="w-5 h-5 text-golf-purple" />
        <h2 className="text-lg font-semibold text-golf-text">参数对比</h2>
        <div className="ml-auto relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={compareItems.length >= 4}
            className="px-3 py-1.5 bg-golf-purple/20 text-golf-purple text-xs rounded hover:bg-golf-purple/30 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" /> 添加对比
          </button>
          
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-golf-bg-light border border-golf-border rounded-lg shadow-xl z-10 p-2">
              <div className="text-xs text-golf-text-muted mb-2 px-2">
                将当前帧 ({selectedFrameIndex}) 添加到对比
              </div>
              <button
                onClick={addCompareItem}
                className="w-full px-3 py-2 text-sm text-golf-text hover:bg-golf-bg rounded text-left"
              >
                添加帧 {selectedFrameIndex}
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-xs text-golf-text-muted mb-2">对比帧列表</div>
        <div className="space-y-2">
          {compareItems.map((item, index) => (
            <div 
              key={index}
              className="flex items-center gap-2 p-2 bg-golf-bg border border-golf-border rounded-lg"
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateCompareItemLabel(index, e.target.value)}
                className="flex-1 bg-transparent text-sm text-golf-text outline-none"
              />
              <span className="text-xs text-golf-text-muted font-mono">
                帧 {item.frameIndex}
              </span>
              <button
                onClick={() => flyToFrame(item.frameIndex)}
                className="px-2 py-1 text-xs bg-golf-blue/20 text-golf-blue rounded hover:bg-golf-blue/30 transition-colors"
              >
                定位
              </button>
              {compareItems.length > 1 && (
                <button
                  onClick={() => removeCompareItem(index)}
                  className="p-1 text-golf-text-muted hover:text-golf-red transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {compareItems.length < 2 ? (
        <div className="text-center py-12 text-golf-text-muted">
          <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">至少需要2个对比项</p>
          <p className="text-xs mt-1">点击上方按钮添加对比帧</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comparisonData.map(group => (
            <div 
              key={group.key}
              className="bg-golf-bg-light border border-golf-border rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-golf-bg/50 transition-colors"
              >
                <span className="text-sm font-medium text-golf-text">{group.label}</span>
                <ChevronDown className={`w-4 h-4 text-golf-text-muted transition-transform ${
                  expandedGroups.includes(group.key) ? 'rotate-180' : ''
                }`} />
              </button>
              
              {expandedGroups.includes(group.key) && (
                <div className="border-t border-golf-border/50">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-golf-bg/50">
                          <th className="px-4 py-2 text-left text-xs text-golf-text-muted font-medium">参数</th>
                          {compareItems.map((item, idx) => (
                            <th 
                              key={idx} 
                              className="px-4 py-2 text-center text-xs font-medium"
                              style={{ color: item.color }}
                            >
                              {item.label}
                            </th>
                          ))}
                          {compareItems.length > 1 && (
                            <th className="px-4 py-2 text-center text-xs text-golf-text-muted font-medium">
                              差值
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {group.params.map((param: any) => (
                          <tr key={param.key} className="border-t border-golf-border/30 hover:bg-golf-bg/30">
                            <td className="px-4 py-2">
                              <span className="text-golf-text">{param.label}</span>
                              <span className="text-xs text-golf-text-muted ml-1">({param.unit})</span>
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-golf-text">
                              {param.baseValue.toFixed(2)}
                            </td>
                            {param.comparisons.map((comp: any, idx: number) => (
                              <td 
                                key={idx} 
                                className="px-4 py-2 text-center font-mono"
                                style={{ color: compareItems[comp.itemIndex].color }}
                              >
                                {comp.value.toFixed(2)}
                              </td>
                            ))}
                            {param.comparisons.length > 0 && (
                              <td className="px-4 py-2 text-center">
                                <div className="flex flex-col gap-1">
                                  {param.comparisons.map((comp: any, idx: number) => (
                                    <div key={idx} className="text-xs">
                                      <span style={{ color: compareItems[comp.itemIndex].color }}>
                                        vs {compareItems[0].label}:
                                      </span>
                                      <span className="ml-1">
                                        <DiffIndicator diff={comp.diff} />
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {compareItems.length >= 2 && (
        <div className="mt-4 p-3 bg-golf-bg-light border border-golf-border rounded-lg">
          <div className="text-xs text-golf-text-muted mb-2">对比说明</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-3 h-3 text-golf-green" />
              <span className="text-golf-text-muted">高于基准值</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3 h-3 text-golf-red" />
              <span className="text-golf-text-muted">低于基准值</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="w-3 h-3 text-golf-text-muted" />
              <span className="text-golf-text-muted">差异可忽略</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
