interface StatCardProps {
  title: string;
  value: number;
  color: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function StatCard({ title, value, color, onClick, selected }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border-2 rounded-lg p-5 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'ring-2 ring-offset-2 shadow-lg' : ''
      }`}
      style={{
        borderColor: `${color}40`,
        ringColor: selected ? color : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        ></div>
      </div>
      <p
        className="text-3xl font-bold mt-2 font-mono"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
