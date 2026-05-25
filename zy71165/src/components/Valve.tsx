import React from 'react';
import type { Valve as ValveType } from '../engine/types';

interface ValveProps {
  valve: ValveType;
  onClick: () => void;
  isHighlighted?: boolean;
  disabled?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const Valve: React.FC<ValveProps> = ({ valve, onClick, isHighlighted, disabled, onMouseEnter, onMouseLeave }) => {
  const { x, y } = valve.position;
  const radius = valve.isMainValve ? 18 : 14;

  const getColor = () => {
    if (valve.isMainValve) {
      return valve.isOpen ? '#f59e0b' : '#ef4444';
    }
    return valve.isOpen ? '#22c55e' : '#ef4444';
  };

  const getBorderColor = () => {
    if (isHighlighted) return '#fbbf24';
    return valve.isMainValve ? '#d97706' : '#16a34a';
  };

  return (
    <g
      onClick={disabled ? undefined : onClick}
      className={disabled ? '' : 'cursor-pointer'}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <circle
        cx={x}
        cy={y}
        r={radius + 4}
        fill="none"
        stroke={getBorderColor()}
        strokeWidth={isHighlighted ? 3 : 2}
        className="transition-all duration-200"
      />
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={getColor()}
        className="transition-all duration-200"
      />
      <g transform={`translate(${x - 8}, ${y - 8})`}>
        {valve.isOpen ? (
          <line
            x1="8"
            y1="4"
            x2="8"
            y2="12"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : null}
        <line
          x1="4"
          y1="8"
          x2="12"
          y2="8"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <text
        x={x}
        y={y + radius + 16}
        textAnchor="middle"
        className="fill-gray-300 text-xs font-mono"
      >
        {valve.id}
      </text>
      {valve.isMainValve && (
        <text
          x={x}
          y={y - radius - 6}
          textAnchor="middle"
          className="fill-amber-400 text-xs font-bold"
        >
          主阀
        </text>
      )}
    </g>
  );
};
