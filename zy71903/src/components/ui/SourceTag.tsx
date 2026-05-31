import { Music, FileText, Hand } from 'lucide-react';
import { DataSource } from '../../types';
import { getSourceLabel } from '../../utils/friendlyMessages';

interface SourceTagProps {
  source: DataSource;
  showIcon?: boolean;
}

export function SourceTag({ source, showIcon = true }: SourceTagProps) {
  const label = getSourceLabel(source);

  const iconMap: Record<DataSource, React.ReactNode> = {
    [DataSource.METRONOME]: <Music className="w-3 h-3" />,
    [DataSource.MUSIC_SHEET]: <FileText className="w-3 h-3" />,
    [DataSource.MANUAL]: <Hand className="w-3 h-3" />,
  };

  const classMap: Record<DataSource, string> = {
    [DataSource.METRONOME]: 'source-metronome',
    [DataSource.MUSIC_SHEET]: 'source-musicsheet',
    [DataSource.MANUAL]: 'source-manual',
  };

  return (
    <span className={`source-tag ${classMap[source]}`}>
      {showIcon && iconMap[source]}
      {label}
    </span>
  );
}
