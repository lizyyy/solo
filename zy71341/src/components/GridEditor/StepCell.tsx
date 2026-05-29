import React, { useState } from 'react';
import { Note } from '@/types';

interface StepCellProps {
  note: Note;
  trackColor: string;
  isActive: boolean;
  isCurrentStep: boolean;
  hasIssue: boolean;
  issueType?: string;
  onClick: () => void;
  onVelocityChange: (velocity: number) => void;
}

export const StepCell: React.FC<StepCellProps> = ({
  note,
  trackColor,
  isActive,
  isCurrentStep,
  hasIssue,
  issueType,
  onClick,
  onVelocityChange,
}) => {
  const [showVelocitySlider, setShowVelocitySlider] = useState(false);

  const getIssueColor = () => {
    if (issueType?.includes('over') || issueType?.includes('high')) return '#FF3366';
    if (issueType?.includes('low')) return '#FF6B35';
    return '#FF6B35';
  };

  return (
    <div className="relative group">
      <div
        className={`
          w-full h-10 rounded cursor-pointer transition-all duration-100
          flex items-center justify-center
          ${isCurrentStep ? 'ring-2 ring-neon-blue ring-opacity-80' : ''}
          ${isActive ? '' : 'bg-dark-700 hover:bg-dark-600'}
          ${hasIssue ? 'animate-pulse-slow' : ''}
        `}
        style={{
          backgroundColor: isActive ? trackColor : undefined,
          opacity: isActive ? 0.3 + (note.velocity / 127) * 0.7 : 1,
          boxShadow: hasIssue ? `0 0 8px ${getIssueColor()}` : isActive ? `0 0 4px ${trackColor}` : undefined,
          border: hasIssue ? `1px solid ${getIssueColor()}` : '1px solid #32324A',
        }}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          if (isActive) setShowVelocitySlider(!showVelocitySlider);
        }}
        title={isActive ? `力度: ${note.velocity} (右键调整)` : '点击添加音符'}
      >
        {isActive && (
          <div
            className="w-1 rounded-full"
            style={{
              height: `${(note.velocity / 127) * 70}%`,
              backgroundColor: 'rgba(255,255,255,0.8)',
            }}
          />
        )}
        {hasIssue && (
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-neon-red animate-pulse" />
        )}
      </div>

      {showVelocitySlider && (
        <div className="absolute z-20 top-full left-1/2 transform -translate-x-1/2 mt-2 bg-dark-700 p-3 rounded-lg shadow-lg border border-dark-500">
          <input
            type="range"
            min="0"
            max="127"
            value={note.velocity}
            onChange={(e) => onVelocityChange(Number(e.target.value))}
            className="w-24 h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${(note.velocity / 127) * 100}%, #32324A ${(note.velocity / 127) * 100}%, #32324A 100%)`,
            }}
          />
          <div className="text-xs text-center mt-1 text-gray-400">{note.velocity}</div>
        </div>
      )}
    </div>
  );
};
