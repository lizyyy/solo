import { Shield, Lightbulb, FileText } from 'lucide-react';

interface Props {
  type: 'insurance' | 'lighting' | 'artwork_list';
}

const SourceTypeBadge = ({ type }: Props) => {
  const config = {
    insurance: { icon: Shield, label: '保险单' },
    lighting: { icon: Lightbulb, label: '灯光记录' },
    artwork_list: { icon: FileText, label: '作品清单' },
  };

  const { icon: Icon, label } = config[type];

  return (
    <span className="inline-flex items-center gap-1 text-xs text-gallery-amber">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

export default SourceTypeBadge;
