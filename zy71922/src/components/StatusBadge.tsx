interface Props {
  status: 'unchecked' | 'checked' | 'disputed' | 'corrected';
}

const StatusBadge = ({ status }: Props) => {
  const config = {
    unchecked: { color: 'bg-gallery-muted', label: '未核对' },
    checked: { color: 'bg-gallery-sage', label: '已核对' },
    disputed: { color: 'bg-gallery-rust', label: '有争议' },
    corrected: { color: 'bg-gallery-amber', label: '已修正' },
  };

  const { color, label } = config[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
};

export default StatusBadge;
