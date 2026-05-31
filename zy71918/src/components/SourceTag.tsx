import React from 'react';
import { SOURCE_TYPE_CONFIG } from 'shared/constants';
import type { SourceType } from 'shared/types';
import { Scissors, FileText, Music } from 'lucide-react';

interface SourceTagProps {
  type: SourceType;
  showIcon?: boolean;
}

const iconMap = {
  edit_point: Scissors,
  ad_script: FileText,
  audio_track: Music,
};

const SourceTag: React.FC<SourceTagProps> = ({ type, showIcon = true }) => {
  const config = SOURCE_TYPE_CONFIG[type];
  const Icon = iconMap[type];

  return (
    <span
      className="source-tag"
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
};

export default SourceTag;
