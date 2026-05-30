import { memo } from 'react';
import { motion } from 'framer-motion';
import type { CircuitComponent as CircuitComponentType } from '@/types';
import { cn } from '@/lib/utils';
import { getComponentColor } from '@/utils/componentFactory';

interface CircuitComponentProps {
  component: CircuitComponentType;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (id: string) => void;
  onNodeClick: (nodeId: string) => void;
  onDragStart: (e: React.MouseEvent, component: CircuitComponentType) => void;
  onToggle?: (id: string) => void;
}

export const CircuitComponent = memo(function CircuitComponent({
  component,
  isSelected,
  isHighlighted,
  onSelect,
  onNodeClick,
  onDragStart,
  onToggle,
}: CircuitComponentProps) {
  const color = getComponentColor(component.type);
  const isOn = component.state === 'on' || component.state === 'normal';

  const renderComponent = () => {
    switch (component.type) {
      case 'power':
        return (
          <g>
            <rect
              x="0"
              y="0"
              width={component.width}
              height={component.height}
              rx="8"
              fill="#1E293B"
              stroke={color}
              strokeWidth="2"
            />
            <text
              x={component.width / 2}
              y={component.height / 2 - 8}
              textAnchor="middle"
              fill={color}
              fontSize="14"
              fontFamily="Orbitron, sans-serif"
              fontWeight="bold"
            >
              {component.properties.voltage}V
            </text>
            <circle
              cx={component.width / 2 - 12}
              cy={component.height / 2 + 12}
              r="4"
              fill="#EF4444"
            />
            <circle
              cx={component.width / 2 + 12}
              cy={component.height / 2 + 12}
              r="4"
              fill="#10B981"
            />
            <text
              x={component.width / 2 - 12}
              y={component.height / 2 + 28}
              textAnchor="middle"
              fill="#EF4444"
              fontSize="10"
            >
              +
            </text>
            <text
              x={component.width / 2 + 12}
              y={component.height / 2 + 28}
              textAnchor="middle"
              fill="#10B981"
              fontSize="10"
            >
              -
            </text>
          </g>
        );

      case 'switch':
        const isSwitchOn = component.state === 'on';
        return (
          <g onClick={(e) => { e.stopPropagation(); onToggle?.(component.id); }} style={{ cursor: 'pointer' }}>
            <rect
              x="0"
              y="0"
              width={component.width}
              height={component.height}
              rx="6"
              fill="#1E293B"
              stroke={color}
              strokeWidth="2"
            />
            <line
              x1="10"
              y1={component.height / 2}
              x2={isSwitchOn ? component.width - 10 : component.width - 20}
              y2={isSwitchOn ? component.height / 2 : component.height / 2 - 15}
              stroke={isSwitchOn ? '#10B981' : '#EF4444'}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle
              cx="10"
              cy={component.height / 2}
              r="4"
              fill={isSwitchOn ? '#10B981' : '#EF4444'}
            />
            <circle
              cx={component.width - 10}
              cy={component.height / 2}
              r="4"
              fill={isSwitchOn ? '#10B981' : '#94A3B8'}
            />
          </g>
        );

      case 'bulb':
        const bulbBrightness = component.nodes[0]?.voltage > 0 ? 1 : 0.3;
        return (
          <g className={bulbBrightness > 0.5 ? 'bulb-glow-on' : ''}>
            <circle
              cx={component.width / 2}
              cy={component.height / 2 - 5}
              r="18"
              fill={bulbBrightness > 0.5 ? '#F59E0B' : '#334155'}
              opacity={bulbBrightness}
            />
            <circle
              cx={component.width / 2}
              cy={component.height / 2 - 5}
              r="14"
              fill={bulbBrightness > 0.5 ? '#FBBF24' : '#475569'}
            />
            <path
              d={`M${component.width / 2 - 10} ${component.height / 2 + 10} 
                  L${component.width / 2 + 10} ${component.height / 2 + 10}
                  L${component.width / 2 + 6} ${component.height - 5}
                  L${component.width / 2 - 6} ${component.height - 5} Z`}
              fill="#64748B"
            />
            {bulbBrightness > 0.5 && (
              <>
                <line x1={component.width / 2} y1="0" x2={component.width / 2} y2="-10" stroke="#F59E0B" strokeWidth="2" opacity="0.6" />
                <line x1="0" y1={component.height / 2 - 5} x2="-10" y2={component.height / 2 - 5} stroke="#F59E0B" strokeWidth="2" opacity="0.6" />
                <line x1={component.width} y1={component.height / 2 - 5} x2={component.width + 10} y2={component.height / 2 - 5} stroke="#F59E0B" strokeWidth="2" opacity="0.6" />
              </>
            )}
          </g>
        );

      case 'resistor':
        return (
          <g>
            <rect
              x="0"
              y="0"
              width={component.width}
              height={component.height}
              rx="4"
              fill="#1E293B"
              stroke={color}
              strokeWidth="2"
            />
            <polyline
              points={`10,${component.height / 2} 
                       20,${component.height / 2 - 8}
                       30,${component.height / 2 + 8}
                       40,${component.height / 2 - 8}
                       50,${component.height / 2 + 8}
                       60,${component.height / 2 - 8}
                       ${component.width - 10},${component.height / 2}`}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x={component.width / 2}
              y={component.height - 5}
              textAnchor="middle"
              fill={color}
              fontSize="10"
            >
              {component.properties.resistance}Ω
            </text>
          </g>
        );

      case 'bar':
        const barVoltage = component.nodes[0]?.voltage || 0;
        const barBrightness = barVoltage > 0 ? Math.min(1, barVoltage / (component.properties.ratedVoltage || 6)) : 0;
        return (
          <g className={barBrightness > 0.5 ? 'bulb-glow-on' : ''}>
            <rect
              x="0"
              y="0"
              width={component.width}
              height={component.height}
              rx="8"
              fill="#1E293B"
              stroke={color}
              strokeWidth="2"
            />
            <rect
              x="10"
              y="10"
              width={component.width - 20}
              height="35"
              rx="4"
              fill={barBrightness > 0.5 ? '#06B6D4' : '#334155'}
              opacity={0.3 + barBrightness * 0.7}
            />
            <circle
              cx={component.width / 2 - 15}
              cy="55"
              r="8"
              fill={barBrightness > 0.8 ? '#F59E0B' : '#334155'}
            />
            <circle
              cx={component.width / 2}
              cy="55"
              r="8"
              fill={barBrightness > 0.5 ? '#F59E0B' : '#334155'}
            />
            <circle
              cx={component.width / 2 + 15}
              cy="55"
              r="8"
              fill={barBrightness > 0.8 ? '#F59E0B' : '#334155'}
            />
            <text
              x={component.width / 2}
              y={component.height - 10}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="10"
            >
              吧台 {component.properties.barId}
            </text>
          </g>
        );

      default:
        return null;
    }
  };

  return (
    <g
      transform={`translate(${component.x}, ${component.y})`}
      onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
      onMouseDown={(e) => onDragStart(e, component)}
      className="cursor-move"
      style={{ filter: isSelected ? 'drop-shadow(0 0 10px #8B5CF6)' : isHighlighted ? 'drop-shadow(0 0 10px #EF4444)' : 'none' }}
    >
      <motion.g
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {renderComponent()}
        {component.nodes.map((node, index) => (
          <g key={node.id} onClick={(e) => { e.stopPropagation(); onNodeClick(node.id); }}>
            <motion.circle
              cx={index === 0 ? 0 : component.width}
              cy={component.height / 2}
              r="6"
              fill="#8B5CF6"
              stroke="white"
              strokeWidth="2"
              className="cursor-crosshair"
              whileHover={{ scale: 1.3, fill: '#A78BFA' }}
              whileTap={{ scale: 0.9 }}
            />
          </g>
        ))}
        {isSelected && (
          <rect
            x="-5"
            y="-5"
            width={component.width + 10}
            height={component.height + 10}
            rx="12"
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="2"
            strokeDasharray="5,5"
            className="animate-pulse"
          />
        )}
        {isHighlighted && (
          <rect
            x="-5"
            y="-5"
            width={component.width + 10}
            height={component.height + 10}
            rx="12"
            fill="none"
            stroke="#EF4444"
            strokeWidth="3"
            className="animate-pulse"
          />
        )}
      </motion.g>
    </g>
  );
});
