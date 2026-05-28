import { useState } from 'react';
import { Layers, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { MODE_TYPE_COLORS, MODULATION_TYPE_COLORS, QUALITY_COLORS, CHORD_FUNCTION_COLORS } from '../../types';
import { getModeName, getModulationTypeName, getQualityName } from '../../utils/musicTheory';

interface LegendItemProps {
  color: string;
  label: string;
}

const LegendItem = ({ color, label }: LegendItemProps) => (
  <div className="flex items-center gap-2">
    <div
      className="w-3 h-3 rounded-full"
      style={{ backgroundColor: color }}
    />
    <span className="text-xs text-slate-300">{label}</span>
  </div>
);

interface LegendGroupProps {
  title: string;
  items: Array<{ key: string; label: string }>;
  colorMap: Record<string, string>;
}

const LegendGroup = ({ title, items, colorMap }: LegendGroupProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-1"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )}
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="flex flex-wrap gap-3 pl-5">
          {items.map((item) => (
            <LegendItem
              key={item.key}
              color={colorMap[item.key]}
              label={item.label}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface LegendBarProps {
  onExport: () => void;
}

const LegendBar = ({ onExport }: LegendBarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const modeTypes = [
    { key: 'major', label: '大调' },
    { key: 'minor', label: '小调' },
    { key: 'dorian', label: '多利亚' },
    { key: 'phrygian', label: '弗里吉亚' },
    { key: 'lydian', label: '利底亚' },
    { key: 'mixolydian', label: '混合利底亚' },
    { key: 'aeolian', label: '爱奥尼亚' },
    { key: 'locrian', label: '洛克里亚' },
  ];

  const modulationTypes = [
    { key: 'direct', label: '直接转调' },
    { key: 'pivot', label: '中介和弦' },
    { key: 'sequential', label: '模进转调' },
    { key: 'enharmonic', label: '等音转调' },
  ];

  const dataQualities = [
    { key: 'normal', label: '正常' },
    { key: 'borderline', label: '临界' },
    { key: 'error', label: '错误' },
  ];

  const chordFunctions = [
    { key: 'tonic', label: '主和弦 (I)' },
    { key: 'supertonic', label: '上主和弦 (ii)' },
    { key: 'mediant', label: '中和弦 (iii)' },
    { key: 'subdominant', label: '下属和弦 (IV)' },
    { key: 'dominant', label: '属和弦 (V)' },
    { key: 'submediant', label: '下中和弦 (vi)' },
    { key: 'leading', label: '导和弦 (vii°)' },
  ];

  if (isCollapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 hover:bg-slate-800/90 transition-colors"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-slate-200">图例</span>
          <ChevronUp className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[800px] max-w-[90vw] bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">图例说明</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            导出报告
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <LegendGroup
          title="调式类型 (球体颜色)"
          items={modeTypes}
          colorMap={MODE_TYPE_COLORS}
        />
        <LegendGroup
          title="和弦功能 (八面体颜色)"
          items={chordFunctions}
          colorMap={CHORD_FUNCTION_COLORS}
        />
        <LegendGroup
          title="转调类型 (连线颜色)"
          items={modulationTypes}
          colorMap={MODULATION_TYPE_COLORS}
        />
        <LegendGroup
          title="数据质量 (标记颜色)"
          items={dataQualities}
          colorMap={QUALITY_COLORS}
        />
        
        <div className="pt-2 border-t border-slate-700/30">
          <div className="flex items-start gap-2 text-xs text-slate-400">
            <div className="flex-1">
              <span className="text-slate-500">坐标轴:</span> X轴 - 五度圈位置 | Y轴 - 功能层级 | Z轴 - 调式亮度
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>� 球体 = 调式</span>
            <span>🔺 八面体 = 和弦</span>
            <span>〰️ 虚线 = 断裂路径</span>
            <span>🔴 红色标记 = 数据问题</span>
            <span>💫 点击节点 = 查看详情</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegendBar;
