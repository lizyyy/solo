import { motion } from 'framer-motion';
import { TOOL_DEFINITIONS } from '../../utils/traceability';
import { useEditorStore } from '../../store/useEditorStore';
import {
  Zap,
  Target,
  Minus,
  CornerDownLeft,
  CornerDownRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  HelpCircle,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Target,
  Minus,
  CornerDownLeft,
  CornerDownRight,
  ArrowDownToLine,
  ArrowUpFromLine,
};

export function Toolbar() {
  const { highlightedToolId, setHighlightedToolId, setDraggingTool, setDragOffset } = useEditorStore();

  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || HelpCircle;
    return <Icon className="w-5 h-5" />;
  };

  const onDragStart = (tool: any, e: React.MouseEvent) => {
    setDraggingTool(tool);
    setDragOffset({ x: 20, y: 20 });
  };

  const trackTools = TOOL_DEFINITIONS.filter((t) => t.type === 'track');
  const magneticTools = TOOL_DEFINITIONS.filter((t) => t.type === 'magnetic');

  return (
    <div className="w-56 bg-space-dark/80 backdrop-blur-sm border-r border-tech-gray/30 p-4 overflow-y-auto">
      <h2 className="font-display font-bold text-plasma-blue text-sm mb-4 tracking-wider">
        工具栏
      </h2>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs text-tech-light font-mono mb-2 uppercase tracking-wider">
            轨道元素
          </h3>
          <div className="space-y-2">
            {trackTools.map((tool) => {
              const isHighlighted = highlightedToolId === tool.id;
              return (
                <motion.div
                  key={tool.id}
                  className={`p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200 border-2 ${
                    isHighlighted
                      ? 'bg-plasma-blue/20 border-plasma-blue shadow-glow-blue'
                      : 'bg-space-medium border-transparent hover:border-plasma-blue/50 hover:bg-space-dark'
                  }`}
                  draggable
                  onMouseDown={(e) => onDragStart(tool, e)}
                  onMouseEnter={() => setHighlightedToolId(tool.id)}
                  onMouseLeave={() => setHighlightedToolId(null)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        tool.type === 'track' && tool.subType === 'start'
                          ? 'bg-neon-green/20 text-neon-green'
                          : tool.type === 'track' && tool.subType === 'end'
                          ? 'bg-energy-red/20 text-energy-red'
                          : 'bg-plasma-blue/20 text-plasma-blue'
                      }`}
                    >
                      {getIcon(tool.icon)}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white">{tool.name}</div>
                      <div className="font-mono text-xs text-tech-light">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs font-mono text-tech-light/70">
                    ID: <span className="text-plasma-blue">{tool.id}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-tech-light font-mono mb-2 uppercase tracking-wider">
            磁场块
          </h3>
          <div className="space-y-2">
            {magneticTools.map((tool) => {
              const isHighlighted = highlightedToolId === tool.id;
              return (
                <motion.div
                  key={tool.id}
                  className={`p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200 border-2 ${
                    isHighlighted
                      ? 'bg-magnetic-purple/20 border-magnetic-purple shadow-glow-purple'
                      : 'bg-space-medium border-transparent hover:border-magnetic-purple/50 hover:bg-space-dark'
                  }`}
                  draggable
                  onMouseDown={(e) => onDragStart(tool, e)}
                  onMouseEnter={() => setHighlightedToolId(tool.id)}
                  onMouseLeave={() => setHighlightedToolId(null)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-magnetic-purple/20 text-magnetic-purple">
                      {getIcon(tool.icon)}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white">{tool.name}</div>
                      <div className="font-mono text-xs text-tech-light">
                        {tool.description}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs font-mono text-tech-light/70">
                    ID: <span className="text-magnetic-purple">{tool.id}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 p-3 bg-space-medium/50 rounded-lg border border-tech-gray/20">
        <p className="text-xs font-mono text-tech-light">
          💡 拖拽元素到画布，点击元素可溯源到工具栏，按 Delete 键删除选中元素
        </p>
      </div>
    </div>
  );
}
